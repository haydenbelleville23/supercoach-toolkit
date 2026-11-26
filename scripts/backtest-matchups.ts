/**
 * RESEARCH ONLY. Multi-season matchup backtest.
 *
 *   node scripts/backtest-matchups.ts
 *
 * Walk-forward on 2026 origins 5-17: predict O+1..O+3 from all 2025 data
 * (data/history/matchups-2025.json, built by `npm run build:history`) plus
 * 2026 up to O. If the 2025 file isn't there yet, it runs on 2026 only and
 * says so. Base projection: the plain season average, with 50 for 2026
 * debutants yet to play. Features added on top:
 *   a. player-versus-opponent residual, shrunk n/(n+k)
 *   b. team-by-position concession, shrunk
 *   c. rucks: the opposing main ruck's effect plus the team's ruck concession
 *   d. combined (a + b, plus the ruck effect for rucks)
 * Parameters chosen on origins 5-11, tested on 12-17, with the same price
 * comparison, played filter and player bootstrap as backtest-projections.
 * Local data only. CSVs go to scripts/output/.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.cwd();

// Module resolution: "@/" alias and extensionless imports.
type ResolveHook = (
  specifier: string,
  context: { parentURL?: string },
  next: (specifier: string, context: { parentURL?: string }) => unknown,
) => unknown;

const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = specifier;
    if (target.startsWith("@/")) {
      target = pathToFileURL(path.join(ROOT, target.slice(2))).href;
    }
    const isLocal = target.startsWith(".") || target.startsWith("file:");
    if (isLocal && !path.extname(target) && context.parentURL) {
      const filePath = fileURLToPath(new URL(target, context.parentURL));
      for (const extension of [".ts", ".tsx"]) {
        if (existsSync(filePath + extension)) {
          return nextResolve(pathToFileURL(filePath + extension).href, context);
        }
      }
    }
    return nextResolve(target, context);
  },
});

const C = await import("./backtest/common");
const {
  ORIGINS, HORIZONS, FINAL_ROUND,
  allPlayers, actualById, opponentOf, debutants,
  mean, median, quantile,
  buildOrigin, playedRound, scoreObs, priceObs,
  segmentOf, segmentFor,
  inSample, outSample, both, seg, mae, pairedBootstrap,
  fmt, money, signedMoney, verdict, csv, writeCsvs,
  parsePool, poolFilter, reportMethods, comparisons,
} = C;
type OriginContext = ReturnType<typeof C.buildOrigin>;
type PlayerState = NonNullable<ReturnType<OriginContext["states"]["get"]>>;
type Obs = ReturnType<typeof C.scoreObs>[number];
type Projections = Parameters<typeof C.scoreObs>[1];
type Filter = ReturnType<typeof C.both>;

const { buildMatchupsFile, normaliseFeedId } = (await import("./history/matchupsFile.mjs")) as unknown as {
  buildMatchupsFile: (input: { season: number; list: unknown[]; records: unknown[]; source: string }) => MatchupsFile;
  normaliseFeedId: (value: unknown) => string | null;
};

// ---------------------------------------------------------------------------
// Seasons of matchup data, keyed by feed_id
// ---------------------------------------------------------------------------

type RoundRow = [number, string | null, string | null, number, number | null, number];
type SeasonPlayer = { id: number; name: string; team: string | null; positions: string[]; rounds: RoundRow[] };
type MatchupsFile = { season: number; byFeedId: Record<string, SeasonPlayer> };

// 2026 from the data we hold, built the same way as the history files.
const detailsDir = path.resolve("data/2026/player-details");
const records2026 = readdirSync(detailsDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(path.join(detailsDir, f), "utf8")));
const season2026 = buildMatchupsFile({ season: 2026, list: records2026, records: records2026, source: "data/2026/player-details" });

const file2025 = path.resolve("data/history/matchups-2025.json");
const have2025 = existsSync(file2025);
const season2025: MatchupsFile | null = have2025 ? JSON.parse(readFileSync(file2025, "utf8")) : null;

const feedOf = new Map(allPlayers.map((p) => [p.id, normaliseFeedId(p.championDataId)]));
const posGroup = (positions: string[]) => positions[0] ?? "UNK";
const isRuck = (positions: string[]) => positions.includes("RUC");

/**
 * One game for the residual pools: score minus the player's own average
 * in that season before the game (needs 2 earlier games that season).
 */
type Game = {
  season: number;
  round: number;
  feed: string;
  team: string | null;
  opponent: string;
  position: string;
  ruck: boolean;
  minutes: number | null;
  residual: number | null;
};

function seasonGames(file: MatchupsFile): Game[] {
  const games: Game[] = [];
  for (const [feed, p] of Object.entries(file.byFeedId)) {
    const scores: number[] = [];
    for (const [round, opponent, , score, minutes] of p.rounds) {
      if (opponent) {
        games.push({
          season: file.season,
          round,
          feed,
          team: p.team,
          opponent,
          position: posGroup(p.positions),
          ruck: isRuck(p.positions),
          minutes,
          residual: scores.length >= 2 ? score - mean(scores) : null,
        });
      }
      scores.push(score);
    }
  }
  return games;
}

const games2025 = season2025 ? seasonGames(season2025) : [];
const games2026 = seasonGames(season2026);

/** Main ruck of a team in a season round: the RUC-listed player with the most minutes. */
function mainRucks(games: Game[]) {
  const best = new Map<string, { feed: string; minutes: number }>();
  for (const g of games) {
    if (!g.ruck || !g.team) continue;
    const key = `${g.season}:${g.round}:${g.team}`;
    const minutes = g.minutes ?? 0;
    const current = best.get(key);
    if (!current || minutes > current.minutes) best.set(key, { feed: g.feed, minutes });
  }
  return best;
}
const mainRuck = mainRucks([...games2025, ...games2026]);

// ---------------------------------------------------------------------------
// Features at an origin
// ---------------------------------------------------------------------------

type Pool = Map<string, { sum: number; n: number }>;
const addTo = (pool: Pool, key: string, residual: number) => {
  const a = pool.get(key) ?? { sum: 0, n: 0 };
  a.sum += residual;
  a.n += 1;
  pool.set(key, a);
};

type Model = { pvo: Pool; teamPos: Pool; ruckVs: Pool; meetings: Map<string, number> };

/** Pools from all 2025 games plus 2026 games up to round O (no later data). */
function buildModel(origin: number): Model {
  const pvo: Pool = new Map();
  const teamPos: Pool = new Map();
  const ruckVs: Pool = new Map();
  const meetings = new Map<string, number>();

  for (const g of [...games2025, ...games2026.filter((x) => x.round <= origin)]) {
    const pair = `${g.feed}:${g.opponent}`;
    meetings.set(pair, (meetings.get(pair) ?? 0) + 1);
    if (g.residual === null) continue;
    addTo(pvo, pair, g.residual);
    addTo(teamPos, `${g.opponent}:${g.position}`, g.residual);
    if (g.ruck) {
      const opposing = mainRuck.get(`${g.season}:${g.round}:${g.opponent}`);
      if (opposing && opposing.feed !== g.feed) addTo(ruckVs, opposing.feed, g.residual);
    }
  }
  return { pvo, teamPos, ruckVs, meetings };
}

/** The opposing team's main ruck in its latest 2026 game up to O. */
function expectedOpposingRuck(team: string, origin: number) {
  for (let r = origin; r >= 0; r--) {
    const m = mainRuck.get(`2026:${r}:${team}`);
    if (m) return m.feed;
  }
  return null;
}

const shrunk = (pool: Pool, key: string, k: number) => {
  const a = pool.get(key);
  return a ? a.sum / (a.n + k) : 0; // average x n/(n+k)
};

type Params = { a: number | null; b: number | null; c: number | null; lm?: number | null };

function adjustment(model: Model, state: PlayerState, opponent: string, origin: number, p: Params) {
  const feed = feedOf.get(state.id);
  const player = actualById.get(state.id)!;
  let adj = 0;
  if (p.a !== null && feed) adj += shrunk(model.pvo, `${feed}:${opponent}`, p.a);
  // Last meeting only: exactly one prior meeting, with a residual.
  if (p.lm != null && feed) {
    const pair = `${feed}:${opponent}`;
    const pool = model.pvo.get(pair);
    if (model.meetings.get(pair) === 1 && pool?.n === 1) adj += p.lm * pool.sum;
  }
  if (p.b !== null) adj += shrunk(model.teamPos, `${opponent}:${state.position}`, p.b);
  if (p.c !== null && isRuck(player.positions)) {
    const ruck = expectedOpposingRuck(opponent, origin);
    if (ruck && ruck !== feed) adj += shrunk(model.ruckVs, ruck, p.c);
    // The team's ruck concession, unless b already adds it.
    if (p.b === null) adj += shrunk(model.teamPos, `${opponent}:RUC`, 40);
  }
  return adj;
}

// ---------------------------------------------------------------------------
// Running the variants
// ---------------------------------------------------------------------------

const K_A = [2, 5, 10, 20];
const K_B = [10, 20, 40, 80];
const K_C = [2, 5, 10, 20];

type Result = { score: Obs[]; price: Obs[] };
const results = new Map<string, Result>();
const add = (name: string, r: Result) => {
  const cur = results.get(name) ?? { score: [], price: [] };
  cur.score.push(...r.score);
  cur.price.push(...r.price);
  results.set(name, cur);
};

const priorMeetings = new Map<string, number>(); // origin:h:pid -> meetings before the target
/** origin:h:pid targets where the last-meeting rule applies (1 meeting, with a residual). */
const lastMeetingApplies = new Set<string>();
const LAST_MEETING_WEIGHTS = [0.05, 0.1, 0.2, 0.3];
const pairCounts: { origin: number; targets: number; zero: number; one: number; two: number; threePlus: number }[] = [];
const contexts: OriginContext[] = [];
const models = new Map<number, Model>();

const baseValue = (s: PlayerState) =>
  s.scores.length ? mean(s.scores) : debutants.has(s.id) ? 50 : null;

function project(ctx: OriginContext, model: Model, p: Params | null): Projections {
  const out: Projections = new Map();
  for (const s of ctx.states.values()) {
    const base = baseValue(s);
    if (base === null) continue;
    const byRound = new Map<number, number | null>();
    for (const h of HORIZONS) {
      const target = ctx.origin + h;
      if (target > FINAL_ROUND) continue;
      const opp = opponentOf.get(`${target}:${s.team}`);
      if (!opp) {
        byRound.set(target, null);
        continue;
      }
      const adj = p === null || s.scores.length === 0 ? 0 : adjustment(model, s, opp, ctx.origin, p);
      byRound.set(target, Math.max(0, base + adj));
    }
    out.set(s.id, byRound);
  }
  return out;
}

const run = (ctx: OriginContext, model: Model, name: string, p: Params | null) => {
  const proj = project(ctx, model, p);
  add(name, { score: scoreObs(ctx, proj), price: priceObs(ctx, proj) });
};

console.log(`Seasons: 2026${have2025 ? " + 2025 (data/history/matchups-2025.json)" : " only (no data/history/matchups-2025.json yet: run download:history and build:history)"}`);
console.log(`2025 players linked: ${season2025 ? Object.keys(season2025.byFeedId).length : 0}; residual games 2025: ${games2025.filter((g) => g.residual !== null).length}, 2026: ${games2026.filter((g) => g.residual !== null).length}`);
console.log("Building origins 5-17...");

for (const origin of ORIGINS) {
  const ctx = buildOrigin(origin);
  contexts.push(ctx);
  const model = buildModel(origin);
  models.set(origin, model);

  const counts = { origin, targets: 0, zero: 0, one: 0, two: 0, threePlus: 0 };
  for (const s of ctx.states.values()) {
    segmentOf.set(`${origin}:${s.id}`, segmentFor(s));
    const feed = feedOf.get(s.id);
    for (const h of HORIZONS) {
      const target = origin + h;
      if (target > FINAL_ROUND || !playedRound(s.id, target)) continue;
      const opp = opponentOf.get(`${target}:${s.team}`);
      const n = feed && opp ? model.meetings.get(`${feed}:${opp}`) ?? 0 : 0;
      priorMeetings.set(`${origin}:${h}:${s.id}`, n);
      if (n === 1 && feed && opp && model.pvo.get(`${feed}:${opp}`)?.n === 1) lastMeetingApplies.add(`${origin}:${h}:${s.id}`);
      counts.targets += 1;
      if (n === 0) counts.zero += 1;
      else if (n === 1) counts.one += 1;
      else if (n === 2) counts.two += 1;
      else counts.threePlus += 1;
    }
  }
  pairCounts.push(counts);

  run(ctx, model, "base", null);
  for (const k of K_A) run(ctx, model, `a:k${k}`, { a: k, b: null, c: null });
  for (const k of K_B) run(ctx, model, `b:k${k}`, { a: null, b: k, c: null });
  for (const k of K_C) run(ctx, model, `c:k${k}`, { a: null, b: null, c: k });
  for (const w of LAST_MEETING_WEIGHTS) run(ctx, model, `lm:w${w}`, { a: null, b: null, c: null, lm: w });
  process.stdout.write(`  origin ${origin} done\n`);
}

const get = (name: string) => results.get(name)!;
const chooseBest = (prefix: string, f: Filter = () => true) =>
  [...results.keys()]
    .filter((n) => n.startsWith(prefix))
    .sort((x, y) => mae(get(x).price, both(inSample, f)).value - mae(get(y).price, both(inSample, f)).value)[0];

const rucks: Filter = seg((s) => s.position === "RUC");
const bestA = chooseBest("a:");
const bestB = chooseBest("b:");
const bestC = chooseBest("c:", rucks);
const kOf = (name: string) => Number(name.split(":k")[1]);

// d: combined, reusing the chosen k values (no new parameters).
for (const ctx of contexts) {
  run(ctx, models.get(ctx.origin)!, "d:combined", { a: kOf(bestA), b: kOf(bestB), c: kOf(bestC) });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log("\n=== PRIOR MEETINGS per (player, opponent) at each origin, played targets ===");
for (const c of pairCounts) {
  console.log(`  O=${c.origin}: ${c.targets} targets; prior meetings 0: ${c.zero}, 1: ${c.one}, 2: ${c.two}, 3+: ${c.threePlus}`);
  csv("pairs", c);
}

const threePlus: Filter = (o) => (priorMeetings.get(`${o.origin}:${o.h}:${o.pid}`) ?? 0) >= 3;
const premiums: Filter = seg((s) => s.price > 600_000);
const segments: [string, Filter][] = [
  ["overall", () => true],
  ["premiums >600k", premiums],
  ["rucks", rucks],
  ["3+ prior meetings", threePlus],
];

console.log(`\n=== FEATURES (chosen on 5-11: a ${bestA}, b ${bestB}, c ${bestC}); out-of-sample 12-17 vs base ===`);
const base = get("base");
for (const name of [bestA, bestB, bestC, "d:combined"]) {
  const r = get(name);
  console.log(`\n${name}`);
  for (const [label, f] of segments) {
    const filter = both(outSample, f);
    const sb = pairedBootstrap(r.score, base.score, filter);
    const pb = pairedBootstrap(r.price, base.price, filter);
    const row = {
      feature: name,
      segment: label,
      n: mae(base.price, filter).n,
      score_mae_base: fmt(mae(base.score, filter).value, 2),
      score_mae_with: fmt(mae(r.score, filter).value, 2),
      score_diff: fmt(sb.diff, 2),
      score_lo: fmt(sb.lo, 2),
      score_hi: fmt(sb.hi, 2),
      price_mae_base: Math.round(mae(base.price, filter).value),
      price_mae_with: Math.round(mae(r.price, filter).value),
      price_diff: Math.round(pb.diff),
      price_lo: Math.round(pb.lo),
      price_hi: Math.round(pb.hi),
      verdict: verdict(pb),
    };
    csv("features", row);
    console.log(`  ${label.padEnd(18)} n=${String(row.n).padStart(5)}  score ${row.score_mae_base} -> ${row.score_mae_with} (${row.score_diff} [${row.score_lo}, ${row.score_hi}]) ${verdict(sb)}; price ${money(row.price_mae_base)} -> ${money(row.price_mae_with)} (${signedMoney(pb.diff)} [${signedMoney(pb.lo)}, ${signedMoney(pb.hi)}]) ${verdict(pb)}`);
  }
}

// Examples: largest fitted player-versus-opponent effects, and what happened.
console.log(`\n=== LARGEST PLAYER-VS-OPPONENT EFFECTS (${bestA}), out-of-sample meetings ===`);
type Example = { name: string; opponent: string; origin: number; target: number; n: number; effect: number; base: number; actual: number };
const examples: Example[] = [];
for (const ctx of contexts.filter((c) => c.origin >= 12)) {
  const model = models.get(ctx.origin)!;
  for (const s of ctx.states.values()) {
    const feed = feedOf.get(s.id);
    if (!feed || s.scores.length === 0) continue;
    for (const h of HORIZONS) {
      const target = ctx.origin + h;
      if (target > FINAL_ROUND || !playedRound(s.id, target)) continue;
      const opp = opponentOf.get(`${target}:${s.team}`)!;
      const pool = model.pvo.get(`${feed}:${opp}`);
      if (!pool) continue;
      examples.push({
        name: actualById.get(s.id)!.name,
        opponent: opp,
        origin: ctx.origin,
        target,
        n: pool.n,
        effect: shrunk(model.pvo, `${feed}:${opp}`, kOf(bestA)),
        base: mean(s.scores),
        actual: actualById.get(s.id)!.history.find((r) => r.round === target)!.score as number,
      });
    }
  }
}
// One row per player-opponent meeting (first origin that predicted it).
const firstPerMeeting = new Map<string, Example>();
for (const e of examples) {
  const key = `${e.name}:${e.opponent}:${e.target}`;
  if (!firstPerMeeting.has(key)) firstPerMeeting.set(key, e);
}
const top = [...firstPerMeeting.values()].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)).slice(0, 10);
for (const e of top) {
  const row = { player: e.name, opponent: e.opponent, origin: e.origin, round: e.target, prior_meetings: e.n, effect: fmt(e.effect), base: fmt(e.base), projected: fmt(e.base + e.effect), actual: e.actual, actual_minus_base: fmt(e.actual - e.base) };
  csv("top_effects", row);
  console.log(`  ${e.name.padEnd(24)} vs ${e.opponent} R${e.target} (from R${e.origin}, ${e.n} prior): effect ${fmt(e.effect)}; base ${fmt(e.base)} -> projected ${fmt(e.base + e.effect)}; actual ${e.actual} (${fmt(e.actual - e.base)} vs base)`);
}
const agree = top.filter((e) => Math.sign(e.effect) === Math.sign(e.actual - e.base)).length;
console.log(`  Direction right in ${agree} of ${top.length}.`);

// Max Gawn against every opponent.
const gawn = allPlayers.find((p) => p.name === "Max Gawn");
if (gawn) {
  const feed = feedOf.get(gawn.id)!;
  const model = models.get(17)!;
  console.log("\n=== MAX GAWN by opponent (meetings in the pools as of Round 17; 2026 results from Round 18 on) ===");
  const opponents = [...new Set([...games2025, ...games2026].filter((g) => g.feed === feed).map((g) => g.opponent))].sort();
  for (const opp of opponents) {
    const pool = model.pvo.get(`${feed}:${opp}`);
    const later = gawn.history.filter((r) => r.round > 17 && r.games > 0 && r.opponent === opp).map((r) => `R${r.round} ${r.score}`);
    const row = { opponent: opp, meetings: model.meetings.get(`${feed}:${opp}`) ?? 0, residual_mean: pool ? fmt(pool.sum / pool.n) : "-", effect: fmt(shrunk(model.pvo, `${feed}:${opp}`, kOf(bestA))), after_round_17: later.join(" ") || "-" };
    csv("gawn", row);
    console.log(`  ${opp}: ${row.meetings} meetings, mean residual ${row.residual_mean}, shrunk effect ${row.effect}; later 2026: ${row.after_round_17}`);
  }
}

// ---------------------------------------------------------------------------
// Power estimate
// ---------------------------------------------------------------------------

console.log("\n=== POWER ESTIMATE (player-versus-opponent) ===");
const residuals = games2026.filter((g) => g.residual !== null).map((g) => g.residual as number);
const sigma = Math.sqrt(mean(residuals.map((r) => r * r)));
const seasonPairs = new Map<string, number>();
for (const g of games2026) seasonPairs.set(`${g.feed}:${g.opponent}`, (seasonPairs.get(`${g.feed}:${g.opponent}`) ?? 0) + 1);
const meetingsPerSeason = mean([...seasonPairs.values()]);
const oosTargets = pairCounts.filter((c) => c.origin >= 12).reduce((t, c) => t + c.targets, 0);
const meanPriorNow = mean(
  [...priorMeetings.entries()].filter(([k]) => Number(k.split(":")[0]) >= 12).map(([, n]) => n),
);

// The spread of pair estimates under no effect is sigma^2/n with a relative
// standard error of sqrt(2/M). A true spread tau is detectable (about 80%
// power at 5%) when tau^2 / (sigma^2/n) >= 2.8 x sqrt(2/M).
const detectable = (n: number, m: number) => sigma * Math.sqrt((2.8 * Math.sqrt(2 / m)) / n);
console.log(`Residual SD (2026): ${fmt(sigma)} points. Meetings per (player, opponent) per season: ${fmt(meetingsPerSeason, 2)}. Out-of-sample targets: ${oosTargets}; average prior meetings now: ${fmt(meanPriorNow, 2)}.`);
const scenarios: [string, number][] = [
  [`as run (${have2025 ? "2025 + 2026 to date" : "2026 to date only"})`, meanPriorNow],
  [have2025 ? "+1 season (2024)" : "+ 2025", meanPriorNow + meetingsPerSeason],
  [have2025 ? "+2 seasons (2024, 2023)" : "+ 2025 and 2024", meanPriorNow + 2 * meetingsPerSeason],
  [have2025 ? "+3 seasons" : "+ 2025, 2024 and 2023", meanPriorNow + 3 * meetingsPerSeason],
];
for (const [label, n] of scenarios) {
  const tau = detectable(n, oosTargets);
  const reliability = (t: number) => (t * t) / (t * t + (sigma * sigma) / n);
  const row = { scenario: label, mean_prior_meetings: fmt(n, 2), smallest_detectable_spread_points: fmt(tau), reliability_at_5pt_effect: fmt(reliability(5), 2), reliability_at_10pt_effect: fmt(reliability(10), 2) };
  csv("power", row);
  console.log(`  ${label.padEnd(34)} ~${fmt(n, 2)} meetings: detectable spread of true effects ≈ ${fmt(tau)} pts; share of a real 5-pt / 10-pt effect recovered after shrinkage: ${fmt(reliability(5), 2)} / ${fmt(reliability(10), 2)}`);
}

// ---------------------------------------------------------------------------

console.log(`\nResidual quartiles (2026): ${fmt(quantile(residuals, 0.25))} / ${fmt(median(residuals))} / ${fmt(quantile(residuals, 0.75))}.`);
// ---------------------------------------------------------------------------
// Restricted pool, side by side with the full pool
// ---------------------------------------------------------------------------

const pool = parsePool(process.argv.slice(2));
const inPool = poolFilter(pool);
console.log(`\n\n=== RESTRICTED POOL: ${pool.label} ===`);
console.log("Only who is SCORED is filtered. Team-by-position, ruck and player-vs-opponent pools, k and every projection still use all players.");
const poolSizes = contexts.map((ctx) => [...ctx.states.values()].filter((st) => inPool({ origin: ctx.origin, h: 1, pid: st.id, err: 0 })).length);
console.log(`Pool size by origin: ${contexts.map((ctx, i) => `R${ctx.origin} ${poolSizes[i]}`).join(", ")}`);
console.log(`Scored predictions (base): rounds 5-11 origins ${base.score.filter((o) => inSample(o) && inPool(o)).length}; 12-17 origins ${base.score.filter((o) => outSample(o) && inPool(o)).length}.`);

const lmFilter: Filter = (o) => lastMeetingApplies.has(`${o.origin}:${o.h}:${o.pid}`);
for (const [label, population] of [["full", () => true], ["restricted", inPool]] as [string, Filter][]) {
  const applied = base.score.filter((o) => population(o) && lmFilter(o));
  console.log(`Last-meeting rule applies to ${applied.filter(inSample).length} scored targets in 5-11 and ${applied.filter(outSample).length} in 12-17 (${label} pool).`);
}

const segmentsM: [string, Filter][] = [
  ["DEF", seg((st) => st.position === "DEF")],
  ["MID", seg((st) => st.position === "MID")],
  ["RUC", seg((st) => st.position === "RUC")],
  ["FWD", seg((st) => st.position === "FWD")],
  ["$450-600k", seg((st) => st.price > 450_000 && st.price <= 600_000)],
  [">$600k", seg((st) => st.price > 600_000)],
  ["3+ prior meetings", threePlus],
  ["last-meeting applies", lmFilter],
];
const variants = [...results.keys()]
  .filter((n) => n !== "base")
  .map((n): [string, string, { score: Obs[]; price: Obs[] }] => [n, n, get(n)]);
reportMethods({ title: "Matchup features vs base, FULL pool, out-of-sample 12-17", methods: variants, baseline: base, population: () => true, segments: segmentsM, csvName: "features_vs_base_full" });
reportMethods({ title: `Matchup features vs base, RESTRICTED pool (${pool.label}), out-of-sample 12-17`, methods: variants, baseline: base, population: inPool, segments: segmentsM, csvName: `features_vs_base${pool.suffix}` });
for (const [label, population] of [["full", () => true], ["restricted", inPool]] as [string, Filter][]) {
  for (const prefix of ["a:", "b:", "c:", "lm:"]) {
    const best = [...results.keys()]
      .filter((n) => n.startsWith(prefix) || n === "base")
      .sort((x, y) => mae(get(x).price, both(inSample, population)).value - mae(get(y).price, both(inSample, population)).value)[0];
    console.log(`Chosen on 5-11 (${label} pool, ${prefix.replace(":", "")}): ${best}`);
  }
}
console.log(`\nInterval comparisons run in this script: ${comparisons.count} (plus the earlier feature tables). About 5% of 95% intervals exclude zero by chance (~${Math.round(comparisons.count * 0.05)}).`);

const csvCount = await writeCsvs("backtest-matchups");
console.log(`CSVs written to scripts/output/backtest-matchups-*.csv (${csvCount} files).`);
