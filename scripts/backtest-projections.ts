/**
 * RESEARCH ONLY. Walk-forward backtest of future-score projections.
 *
 *   node scripts/backtest-projections.ts
 *
 * For each origin round O (5..17), using only data up to and including O
 * (lib/asOf/trimToRound), every method projects each player's scores for
 * O+1..O+3. Scores are compared with actual 2026 scores, and prices with
 * actual published prices: each method's projected scores go through the
 * planner's own price path (createPriceProjector, as score overrides) with
 * the league k estimated the way the planner does.
 *
 * Parameters are chosen on origins 5-11 (in-sample) and reported on
 * origins 12-17 (out-of-sample). Reads local data only: no network, no
 * 2025 data (previous_games is used only to find 2026 debutants), no
 * starting-price prior, no time on ground. Writes CSVs to scripts/output/.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import * as nodeModule from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Player } from "@/types/player";

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Module resolution: "@/" alias and extensionless imports (as in the other
// scripts). No env lock: as-of data is built per origin with trimToRound.
// ---------------------------------------------------------------------------

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

const { trimPlayersToRound } = await import("../lib/asOf/trimToRound");
const { estimateScaledRoundContexts } = await import(
  "../lib/priceEngine/estimateScaledRoundContexts"
);
const { BASE_MAGIC_NUMBER_2026 } = await import("../lib/priceEngine/baseMagicNumber");
const { createPriceProjector } = await import("../lib/planner/pricePaths");

type RawFixtureFile = Parameters<typeof trimPlayersToRound>[1];

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const ORIGINS = Array.from({ length: 13 }, (_, i) => 5 + i); // 5..17
const IN_SAMPLE = new Set(ORIGINS.filter((o) => o <= 11)); // 5..11
const OUT_SAMPLE = new Set(ORIGINS.filter((o) => o >= 12)); // 12..17
const HORIZONS = [1, 2, 3];
const FINAL_ROUND = 24;
const ROOKIE_MAX_GAMES = 5;
const BOOTSTRAP_SAMPLES = 1000;
const OUTPUT_DIR = path.resolve("scripts/output");

// ---------------------------------------------------------------------------
// Data (local files only)
// ---------------------------------------------------------------------------

const allPlayers = JSON.parse(
  readFileSync(path.resolve("data/2026/players-normalised.json"), "utf8"),
) as Player[];
const fixtureFile = JSON.parse(
  readFileSync(path.resolve("data/2026/fixtures-raw.json"), "utf8"),
) as RawFixtureFile;

const actualById = new Map(allPlayers.map((p) => [p.id, p]));

// Opponent for a team in a round, from the published schedule (known in
// advance, so not leakage).
const opponentOf = new Map<string, string>();
const teamPlays = new Set<string>();
for (const round of fixtureFile.rounds) {
  for (const game of round.response) {
    const home = (game.team1 as { abbrev: string }).abbrev;
    const away = (game.team2 as { abbrev: string }).abbrev;
    opponentOf.set(`${round.round}:${home}`, away);
    opponentOf.set(`${round.round}:${away}`, home);
    teamPlays.add(`${round.round}:${home}`);
    teamPlays.add(`${round.round}:${away}`);
  }
}
const plannerFixtures = fixtureFile.rounds.flatMap((round) =>
  round.response.map((game) => ({
    round: round.round,
    homeTeam: (game.team1 as { abbrev: string }).abbrev,
    awayTeam: (game.team2 as { abbrev: string }).abbrev,
  })),
);

// 2026 debutants: no 2025 games (previous_games is read only to define the
// sample) and at least one 2026 game. Also feed_id coverage for section 7.
const detailsDir = path.resolve("data/2026/player-details");
const debutants = new Set<number>();
let detailFiles = 0;
let withFeedId = 0;
let with2025Totals = 0;
for (const file of readdirSync(detailsDir)) {
  const detail = JSON.parse(readFileSync(path.join(detailsDir, file), "utf8")) as {
    id: number;
    feed_id?: string | null;
    previous_games?: number;
  };
  detailFiles += 1;
  if (detail.feed_id) withFeedId += 1;
  if ((detail.previous_games ?? 0) > 0 && detail.feed_id) with2025Totals += 1;
  const played2026 = actualById.get(detail.id)?.history.some((h) => h.games > 0) ?? false;
  if ((detail.previous_games ?? 0) === 0 && played2026) {
    debutants.add(detail.id);
  }
}

// ---------------------------------------------------------------------------
// Small statistics helpers
// ---------------------------------------------------------------------------

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : NaN);
function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo);
};
/** Spread of the player's scores around his own median. */
const sdAroundMedian = (xs: number[]) => {
  const m = median(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const winsorise = (xs: number[]) => {
  const m = median(xs);
  const sd = sdAroundMedian(xs);
  return xs.map((x) => Math.min(m + 1.5 * sd, Math.max(m - 1.5 * sd, x)));
};
/** Exponentially weighted average; the latest score has age 0. */
const ewma = (xs: number[], halfLife: number) => {
  let w = 0;
  let total = 0;
  xs.forEach((x, i) => {
    const weight = 0.5 ** ((xs.length - 1 - i) / halfLife);
    w += weight;
    total += weight * x;
  });
  return total / w;
};
/** Any of the last 3 scores more than 1.5 SD from the player's own median. */
const hadOutlier = (xs: number[]) => {
  if (xs.length < 3) return false;
  const m = median(xs);
  const sd = sdAroundMedian(xs);
  return sd > 0 && xs.slice(-3).some((x) => Math.abs(x - m) > 1.5 * sd);
};

// ---------------------------------------------------------------------------
// Methods
// ---------------------------------------------------------------------------

type GeneralMethod = { name: string; label: string; project: (scores: number[]) => number };

const shrinkToMedian = (value: number, scores: number[], k: number) => {
  const w = scores.length / (scores.length + k);
  return w * value + (1 - w) * median(scores);
};

const K_GRID = [3, 5, 8, 12];

const GENERAL_METHODS: GeneralMethod[] = [
  { name: "mean", label: "a. season mean (baseline)", project: (s) => mean(s) },
  { name: "median", label: "b. median", project: (s) => median(s) },
  { name: "winsor", label: "c. winsorised mean (1.5 SD of own median)", project: (s) => mean(winsorise(s)) },
  ...K_GRID.map((k) => ({
    name: `shrink_k${k}`,
    label: `d. mean shrunk to median, k=${k}`,
    project: (s: number[]) => shrinkToMedian(mean(s), s, k),
  })),
  ...[3, 5].flatMap((hl) =>
    K_GRID.map((k) => ({
      name: `ewma${hl}_k${k}`,
      label: `e. EWMA half-life ${hl}, shrunk to median, k=${k}`,
      project: (s: number[]) => shrinkToMedian(ewma(s, hl), s, k),
    })),
  ),
  ...K_GRID.map((k) => ({
    name: `winsor_ewma5_k${k}`,
    label: `f. (extra) winsorised EWMA half-life 5, shrunk to median, k=${k}`,
    project: (s: number[]) => shrinkToMedian(ewma(winsorise(s), 5), s, k),
  })),
];

/**
 * Rookie trust rule (2 parameters). Trust t starts at `step` after the
 * first game; each later score within `band` (a fraction) of his running
 * mean adds `step`, anything outside it (a spike or a drop) takes `step`
 * away. Projection = t x own average + (1 - t) x typical rookie level.
 */
function trustProjection(scores: number[], typical: number, band: number, step: number) {
  let t = 0;
  let total = 0;
  scores.forEach((s, i) => {
    if (i === 0) {
      t = step;
    } else {
      const m = total / i;
      t = Math.abs(s - m) <= band * Math.max(m, 1) ? Math.min(1, t + step) : Math.max(0, t - step);
    }
    total += s;
  });
  return t * (total / scores.length) + (1 - t) * typical;
}

const TRUST_BANDS = [0.15, 0.25, 0.35, 0.5];
const TRUST_STEPS = [0.2, 0.35, 0.5];
const PRE_DEBUT = [50, 55, 60];

// ---------------------------------------------------------------------------
// Per-origin context
// ---------------------------------------------------------------------------

type PlayerState = {
  id: number;
  team: string;
  position: string;
  price: number;
  scores: number[];
  rounds: number[];
  opponents: (string | null)[];
  rookie: boolean;
  outlier: boolean;
  /** Played his team's most recent completed game up to O. */
  inLineup: boolean;
};

type OriginContext = {
  origin: number;
  trimmed: Player[];
  states: Map<number, PlayerState>;
  contexts: ReturnType<typeof estimateScaledRoundContexts>;
  typicalRookie: number;
};

function buildOrigin(origin: number): OriginContext {
  const trimmed = trimPlayersToRound(allPlayers, fixtureFile, origin);
  const states = new Map<number, PlayerState>();

  for (const p of trimmed) {
    const played = p.history.filter((h) => h.games > 0 && h.score !== null);
    const scores = played.map((h) => h.score as number);

    // His team's last game up to O, and whether he played it.
    let lastTeamRound = -1;
    for (let r = origin; r >= 0; r--) {
      if (teamPlays.has(`${r}:${p.team}`)) {
        lastTeamRound = r;
        break;
      }
    }
    const inLineup = played.some((h) => h.round === lastTeamRound);

    states.set(p.id, {
      id: p.id,
      team: p.team,
      position: p.positions[0] ?? "UNK",
      price: p.price,
      scores,
      rounds: played.map((h) => h.round),
      opponents: played.map((h) => h.opponent),
      rookie: debutants.has(p.id) && scores.length <= ROOKIE_MAX_GAMES,
      outlier: hadOutlier(scores),
      inLineup,
    });
  }

  // Typical rookie level: every debutant's first-5-game scores up to O.
  const rookieScores = [...states.values()]
    .filter((s) => debutants.has(s.id))
    .flatMap((s) => s.scores.slice(0, ROOKIE_MAX_GAMES));
  const typicalRookie = rookieScores.length >= 10 ? mean(rookieScores) : 50;

  const contexts = estimateScaledRoundContexts({
    players: trimmed,
    firstRound: origin + 1,
    lastRound: Math.min(origin + 3, FINAL_ROUND),
    baseMagicNumber: BASE_MAGIC_NUMBER_2026,
    teamHasGame: (team, round) => teamPlays.has(`${round}:${team}`),
  });

  return { origin, trimmed, states, contexts, typicalRookie };
}

// ---------------------------------------------------------------------------
// Ground truth and observations
// ---------------------------------------------------------------------------

type Obs = {
  origin: number;
  h: number;
  pid: number;
  err: number; // projected minus actual
};

const actualRow = (pid: number, round: number) =>
  actualById.get(pid)?.history.find((h) => h.round === round);

const playedRound = (pid: number, round: number) => {
  const row = actualRow(pid, round);
  return !!row && row.games > 0 && row.score !== null;
};

/**
 * Price at O+h is scored when the player played every round from O+1 to
 * O+h in which his team had a game (so the price path's "he plays"
 * assumption held) and played O+h itself.
 */
function priceEligible(state: PlayerState, origin: number, target: number) {
  for (let r = origin + 1; r <= target; r++) {
    if (teamPlays.has(`${r}:${state.team}`) && !playedRound(state.id, r)) return false;
  }
  return playedRound(state.id, target);
}

/** Projected score per player per target round (null = not projected). */
type Projections = Map<number, Map<number, number | null>>;

function scoreObs(ctx: OriginContext, projections: Projections): Obs[] {
  const out: Obs[] = [];
  for (const [pid, byRound] of projections) {
    for (const h of HORIZONS) {
      const target = ctx.origin + h;
      if (target > FINAL_ROUND) continue;
      const projected = byRound.get(target);
      if (projected === null || projected === undefined) continue;
      if (!playedRound(pid, target)) continue;
      out.push({ origin: ctx.origin, h, pid, err: projected - (actualRow(pid, target)!.score as number) });
    }
  }
  return out;
}

function priceObs(ctx: OriginContext, projections: Projections, only?: Set<number>): Obs[] {
  const overrides: Record<number, Record<number, number>> = {};
  for (const [pid, byRound] of projections) {
    for (const [round, score] of byRound) {
      if (score !== null) {
        (overrides[pid] ??= {})[round] = score;
      }
    }
  }

  const projector = createPriceProjector({
    players: ctx.trimmed,
    contexts: ctx.contexts,
    fixtures: plannerFixtures,
    completedRound: ctx.origin,
    lastRound: Math.min(ctx.origin + 3, FINAL_ROUND),
    scoreOverrides: overrides,
  });

  const out: Obs[] = [];
  for (const state of ctx.states.values()) {
    if (only && !only.has(state.id)) continue;
    if (!projections.has(state.id)) continue;
    const path_ = projector.getPath(state.id);
    for (const h of HORIZONS) {
      const target = ctx.origin + h;
      if (target > FINAL_ROUND || !priceEligible(state, ctx.origin, target)) continue;
      const projected = path_.find((r) => r.round === target)?.priceAfter;
      const actual = actualRow(state.id, target)?.price;
      if (projected === undefined || actual == null) continue;
      out.push({ origin: ctx.origin, h, pid: state.id, err: projected - actual });
    }
  }
  return out;
}

/** The same projection for every target round (no matchup). */
function flat(ctx: OriginContext, value: (s: PlayerState) => number | null, filter: (s: PlayerState) => boolean): Projections {
  const out: Projections = new Map();
  for (const state of ctx.states.values()) {
    if (!filter(state)) continue;
    const v = value(state);
    const byRound = new Map<number, number | null>();
    for (const h of HORIZONS) {
      const target = ctx.origin + h;
      if (target > FINAL_ROUND) continue;
      byRound.set(target, teamPlays.has(`${target}:${state.team}`) ? v : null);
    }
    out.set(state.id, byRound);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Matchups
// ---------------------------------------------------------------------------

type MatchupModel = {
  teamPos: Map<string, { sum: number; n: number }>;
  playerOpp: Map<string, { sum: number; n: number }>;
};

/** Residuals (score minus his average before that game, needs 2 prior games), up to O. */
function buildMatchups(ctx: OriginContext): MatchupModel {
  const teamPos = new Map<string, { sum: number; n: number }>();
  const playerOpp = new Map<string, { sum: number; n: number }>();

  for (const state of ctx.states.values()) {
    for (let j = 2; j < state.scores.length; j++) {
      const opp = state.opponents[j];
      if (!opp) continue;
      const residual = state.scores[j] - mean(state.scores.slice(0, j));
      const tp = `${opp}:${state.position}`;
      const po = `${state.id}:${opp}`;
      const a = teamPos.get(tp) ?? { sum: 0, n: 0 };
      a.sum += residual;
      a.n += 1;
      teamPos.set(tp, a);
      const b = playerOpp.get(po) ?? { sum: 0, n: 0 };
      b.sum += residual;
      b.n += 1;
      playerOpp.set(po, b);
    }
  }
  return { teamPos, playerOpp };
}

function matchupAdjustment(
  model: MatchupModel,
  state: PlayerState,
  opponent: string,
  kTeam: number,
  kPlayer: number | null,
) {
  const tp = model.teamPos.get(`${opponent}:${state.position}`);
  const teamEffect = tp ? tp.sum / (tp.n + kTeam) : 0; // = average x n/(n+k)
  if (kPlayer === null) return teamEffect;
  const po = model.playerOpp.get(`${state.id}:${opponent}`);
  if (!po) return teamEffect;
  const own = po.sum / po.n;
  return teamEffect + (own - teamEffect) * (po.n / (po.n + kPlayer));
}

// ---------------------------------------------------------------------------
// Running every method
// ---------------------------------------------------------------------------

type Result = { score: Obs[]; price: Obs[] };
const results = new Map<string, Result>();
const add = (name: string, score: Obs[], price: Obs[]) => {
  const r = results.get(name) ?? { score: [], price: [] };
  r.score.push(...score);
  r.price.push(...price);
  results.set(name, r);
};

const veteran = (s: PlayerState) => !s.rookie && s.scores.length >= 1;
const rookieAfterDebut = (s: PlayerState) => s.rookie && s.scores.length >= 1;
const rookiePreDebut = (s: PlayerState) => s.rookie && s.scores.length === 0;

const segmentOf = new Map<string, { band: string; games: string; position: string; outlier: boolean; price: number; rookie: boolean; gamesN: number }>();
const projectedToPlay = { projected: 0, didNotPlay: 0 };
const pairCounts: { origin: number; targets: number; withPriorMeeting: number; pairs: number }[] = [];
const contexts: OriginContext[] = [];

const band = (price: number) =>
  price < 300_000 ? "<300k" : price < 500_000 ? "300-500k" : price < 700_000 ? "500-700k" : ">700k";
const gamesBand = (g: number) => (g <= 5 ? "1-5" : g <= 10 ? "6-10" : "11+");

console.log("Building origins 5-17 (as-of data, k contexts)...");

for (const origin of ORIGINS) {
  const ctx = buildOrigin(origin);
  contexts.push(ctx);

  for (const s of ctx.states.values()) {
    segmentOf.set(`${origin}:${s.id}`, {
      band: band(s.price),
      games: gamesBand(Math.max(s.scores.length, 1)),
      position: s.position,
      outlier: s.outlier,
      price: s.price,
      rookie: s.rookie,
      gamesN: s.scores.length,
    });

    // "Projected to play": team has a game and he played the team's last game.
    for (const h of HORIZONS) {
      const target = origin + h;
      if (target > FINAL_ROUND) continue;
      if (s.inLineup && teamPlays.has(`${target}:${s.team}`) && s.scores.length > 0) {
        projectedToPlay.projected += 1;
        if (!playedRound(s.id, target)) projectedToPlay.didNotPlay += 1;
      }
    }
  }

  // General methods on non-rookies with at least one game.
  for (const m of GENERAL_METHODS) {
    const proj = flat(ctx, (s) => m.project(s.scores), veteran);
    add(`gen:${m.name}`, scoreObs(ctx, proj), priceObs(ctx, proj));
  }

  // Rookies after debut.
  const rookieAvg = flat(ctx, (s) => mean(s.scores), rookieAfterDebut);
  add("rook:own_average", scoreObs(ctx, rookieAvg), priceObs(ctx, rookieAvg));
  const rookieLast = flat(ctx, (s) => s.scores[s.scores.length - 1], rookieAfterDebut);
  add("rook:last_score", scoreObs(ctx, rookieLast), priceObs(ctx, rookieLast));
  for (const b of TRUST_BANDS) {
    for (const st of TRUST_STEPS) {
      const proj = flat(ctx, (s) => trustProjection(s.scores, ctx.typicalRookie, b, st), rookieAfterDebut);
      add(`rook:trust_b${b}_s${st}`, scoreObs(ctx, proj), priceObs(ctx, proj));
    }
  }

  // Rookies before debut: fixed 50 / 55 / 60.
  for (const v of PRE_DEBUT) {
    const proj = flat(ctx, () => v, rookiePreDebut);
    add(`pre:${v}`, scoreObs(ctx, proj), priceObs(ctx, proj));
  }

  process.stdout.write(`  origin ${origin} done\n`);
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

type Filter = (o: Obs) => boolean;
const inSample: Filter = (o) => IN_SAMPLE.has(o.origin);
const outSample: Filter = (o) => OUT_SAMPLE.has(o.origin);
const horizon = (h: number): Filter => (o) => o.h === h;
const both = (...fs: Filter[]): Filter => (o) => fs.every((f) => f(o));
const seg = (pick: (s: NonNullable<ReturnType<typeof segmentOf.get>>) => boolean): Filter => (o) => {
  const s = segmentOf.get(`${o.origin}:${o.pid}`);
  return !!s && pick(s);
};

const mae = (obs: Obs[], f: Filter = () => true) => {
  const xs = obs.filter(f).map((o) => Math.abs(o.err));
  return { value: mean(xs), n: xs.length };
};
const bias = (obs: Obs[], f: Filter = () => true) => mean(obs.filter(f).map((o) => o.err));

/** Per-origin MAE spread (min, max) on a filter. */
const spread = (obs: Obs[], f: Filter) => {
  const per = [...new Set(obs.filter(f).map((o) => o.origin))].map((origin) =>
    mae(obs, both(f, (o) => o.origin === origin)).value,
  );
  return { min: Math.min(...per), max: Math.max(...per) };
};

/**
 * Paired bootstrap over players: difference in mean absolute error
 * (method minus baseline) on the observations both have. Negative = method
 * better. Returns the point estimate and a 95% interval.
 */
function pairedBootstrap(method: Obs[], baseline: Obs[], f: Filter) {
  const key = (o: Obs) => `${o.origin}:${o.h}:${o.pid}`;
  const base = new Map(baseline.filter(f).map((o) => [key(o), Math.abs(o.err)]));
  const perPlayer = new Map<number, { d: number; n: number }>();
  for (const o of method.filter(f)) {
    const b = base.get(key(o));
    if (b === undefined) continue;
    const p = perPlayer.get(o.pid) ?? { d: 0, n: 0 };
    p.d += Math.abs(o.err) - b;
    p.n += 1;
    perPlayer.set(o.pid, p);
  }
  const players = [...perPlayer.values()];
  if (players.length < 5) return { diff: NaN, lo: NaN, hi: NaN, players: players.length };
  const point = sum(players.map((p) => p.d)) / sum(players.map((p) => p.n));
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const draws: number[] = [];
  for (let b = 0; b < BOOTSTRAP_SAMPLES; b++) {
    let d = 0;
    let n = 0;
    for (let i = 0; i < players.length; i++) {
      const p = players[Math.floor(rand() * players.length)];
      d += p.d;
      n += p.n;
    }
    draws.push(d / n);
  }
  return { diff: point, lo: quantile(draws, 0.025), hi: quantile(draws, 0.975), players: players.length };
}

const fmt = (x: number, digits = 1) => (Number.isFinite(x) ? x.toFixed(digits) : "-");
const money = (x: number) => (Number.isFinite(x) ? `$${Math.round(x).toLocaleString("en-AU")}` : "-");
const signedMoney = (x: number) => (Number.isFinite(x) ? `${x < 0 ? "−" : "+"}$${Math.abs(Math.round(x)).toLocaleString("en-AU")}` : "-");
const verdict = (b: { lo: number; hi: number }) =>
  !Number.isFinite(b.lo) ? "too few players" : b.hi < 0 ? "better (beyond noise)" : b.lo > 0 ? "worse (beyond noise)" : "within noise";

const csvRows: Record<string, Record<string, string | number>[]> = {};
const csv = (name: string, row: Record<string, string | number>) => (csvRows[name] ??= []).push(row);

// ---------------------------------------------------------------------------
// 1. Mid-range and premiums (non-rookies with games)
// ---------------------------------------------------------------------------

const get = (name: string) => results.get(name)!;
const base = get("gen:mean");

function chooseBest(prefix: string, f: Filter) {
  let best = "";
  let bestValue = Infinity;
  for (const [name, r] of results) {
    if (!name.startsWith(prefix)) continue;
    const v = mae(r.price, both(inSample, f)).value;
    if (v < bestValue) {
      bestValue = v;
      best = name;
    }
  }
  return best;
}

const midPrem: Filter = seg((s) => s.gamesN > ROOKIE_MAX_GAMES);

console.log("\n=== 3. MID-RANGE AND PREMIUMS (non-rookies, more than 5 games) ===");
console.log("Chosen by in-sample (origins 5-11) price MAE; reported out-of-sample (12-17).\n");
console.log(
  ["method", "IS price MAE", "OOS price MAE", "OOS +1", "OOS +2", "OOS +3", "OOS score MAE", "OOS bias", "OOS spread (price)"].join(" | "),
);

const inSampleRank: { name: string; is: number; oos: number }[] = [];
for (const m of GENERAL_METHODS) {
  const r = get(`gen:${m.name}`);
  const isP = mae(r.price, both(inSample, midPrem)).value;
  const oosP = mae(r.price, both(outSample, midPrem)).value;
  const sp = spread(r.price, both(outSample, midPrem));
  inSampleRank.push({ name: m.name, is: isP, oos: oosP });
  const row = {
    method: m.label,
    in_sample_price_mae: Math.round(isP),
    oos_price_mae: Math.round(oosP),
    oos_price_mae_h1: Math.round(mae(r.price, both(outSample, midPrem, horizon(1))).value),
    oos_price_mae_h2: Math.round(mae(r.price, both(outSample, midPrem, horizon(2))).value),
    oos_price_mae_h3: Math.round(mae(r.price, both(outSample, midPrem, horizon(3))).value),
    oos_score_mae: fmt(mae(r.score, both(outSample, midPrem)).value),
    oos_score_bias: fmt(bias(r.score, both(outSample, midPrem))),
    oos_origin_spread: `${Math.round(sp.min)}-${Math.round(sp.max)}`,
    n_price_oos: mae(r.price, both(outSample, midPrem)).n,
  };
  csv("general_methods", row);
  console.log(
    [m.label.padEnd(58), money(isP), money(oosP), money(row.oos_price_mae_h1), money(row.oos_price_mae_h2), money(row.oos_price_mae_h3), row.oos_score_mae, row.oos_score_bias, row.oos_origin_spread].join(" | "),
  );
}

const bestGeneral = chooseBest("gen:", midPrem);
// The strongest alternative to the mean (in-sample), for the comparisons.
const bestAlternative = [...inSampleRank]
  .filter((r) => r.name !== "mean")
  .sort((a, b) => a.is - b.is)[0].name;
const isOrder = [...inSampleRank].sort((a, b) => a.is - b.is);
const oosOrder = [...inSampleRank].sort((a, b) => a.oos - b.oos);
const meanOos = inSampleRank.find((r) => r.name === "mean")!.oos;
const overfit = isOrder.slice(0, 5).filter((r) => r.oos >= meanOos).map((r) => r.name);

console.log(`\nBest in-sample: ${bestGeneral}. Out-of-sample best: ${oosOrder[0].name}.`);
console.log(`Top-5 in-sample methods that do NOT beat the mean out-of-sample: ${overfit.join(", ") || "none"}`);

const bestGen = get(`gen:${bestAlternative}`);
const genBoot = pairedBootstrap(bestGen.price, base.price, both(outSample, midPrem));
console.log(
  `Bootstrap (players) best alternative ${bestAlternative} vs mean, OOS price MAE difference: ${signedMoney(genBoot.diff)} [${signedMoney(genBoot.lo)}, ${signedMoney(genBoot.hi)}] over ${genBoot.players} players -> ${verdict(genBoot)}`,
);
for (const h of HORIZONS) {
  const b = pairedBootstrap(bestGen.price, base.price, both(outSample, midPrem, horizon(h)));
  console.log(`  +${h}: ${signedMoney(b.diff)} [${signedMoney(b.lo)}, ${signedMoney(b.hi)}] -> ${verdict(b)}`);
}

// Segments for best vs mean (OOS).
console.log(`\nSegments (OOS, price MAE; mean -> ${bestAlternative}, and paired bootstrap verdict):`);
const segments: [string, Filter][] = [
  ["price <300k", seg((s) => s.band === "<300k")],
  ["price 300-500k", seg((s) => s.band === "300-500k")],
  ["price 500-700k", seg((s) => s.band === "500-700k")],
  ["price >700k", seg((s) => s.band === ">700k")],
  ["premium >600k", seg((s) => s.price > 600_000)],
  ["games 6-10", seg((s) => s.games === "6-10")],
  ["games 11+", seg((s) => s.games === "11+")],
  ["DEF", seg((s) => s.position === "DEF")],
  ["MID", seg((s) => s.position === "MID")],
  ["RUC", seg((s) => s.position === "RUC")],
  ["FWD", seg((s) => s.position === "FWD")],
  ["outlier in last 3", seg((s) => s.outlier)],
  ["no outlier in last 3", seg((s) => !s.outlier)],
];
for (const [label, f] of segments) {
  const filter = both(outSample, midPrem, f);
  const a = mae(base.price, filter);
  const b = mae(bestGen.price, filter);
  const boot = pairedBootstrap(bestGen.price, base.price, filter);
  const sa = mae(base.score, filter).value;
  const sb = mae(bestGen.score, filter).value;
  csv("general_segments", { segment: label, n: a.n, mean_price_mae: Math.round(a.value), best_price_mae: Math.round(b.value), diff: Math.round(boot.diff), lo: Math.round(boot.lo), hi: Math.round(boot.hi), verdict: verdict(boot), mean_score_mae: fmt(sa), best_score_mae: fmt(sb) });
  console.log(`  ${label.padEnd(22)} n=${String(a.n).padStart(5)}  ${money(a.value)} -> ${money(b.value)}  (${signedMoney(boot.diff)} [${signedMoney(boot.lo)}, ${signedMoney(boot.hi)}]) ${verdict(boot)}; score ${fmt(sa)} -> ${fmt(sb)}`);
}

// ---------------------------------------------------------------------------
// 2. Rookies
// ---------------------------------------------------------------------------

console.log("\n=== 2. ROOKIES (2026 debutants with 5 or fewer games) ===");
console.log(`Debutants in the data: ${debutants.size}. Typical rookie level by origin: ${contexts.map((c) => `R${c.origin} ${fmt(c.typicalRookie)}`).join(", ")}`);

const rookieMethods = [...results.keys()].filter((n) => n.startsWith("rook:"));
const bestRookie = chooseBest("rook:trust", () => true);
const rookieCompare = ["rook:own_average", "rook:last_score", bestRookie];

console.log(`\nChosen trust parameters (in-sample price MAE): ${bestRookie}`);
console.log("\nBy games played at the origin (all origins; small sample):");
console.log(["method", "games", "n scores", "score MAE", "bias", "n prices", "price MAE"].join(" | "));
for (const name of rookieCompare) {
  const r = get(name);
  for (let g = 1; g <= ROOKIE_MAX_GAMES; g++) {
    const f = seg((s) => s.rookie && s.gamesN === g);
    const sm = mae(r.score, f);
    const pm = mae(r.price, f);
    csv("rookies_by_games", { method: name, games: g, n_scores: sm.n, score_mae: fmt(sm.value), bias: fmt(bias(r.score, f)), n_prices: pm.n, price_mae: Math.round(pm.value) });
    console.log([name.padEnd(28), g, sm.n, fmt(sm.value), fmt(bias(r.score, f)), pm.n, money(pm.value)].join(" | "));
  }
}

// Price at his first price change (round of his 3rd game) and the next two.
function firstChangeRound(pid: number) {
  const played = actualById.get(pid)!.history.filter((h) => h.games > 0);
  return played.length >= 3 ? played[2].round : null;
}
const firstChange: Filter = (o) => {
  const f = firstChangeRound(o.pid);
  return f !== null && o.origin + o.h >= f && o.origin + o.h <= f + 2;
};
console.log("\nPrice MAE at the first price change (after his 3rd game) and the next two rounds, all origins:");
for (const name of [...rookieCompare]) {
  const r = get(name);
  const pm = mae(r.price, both(firstChange, seg((s) => s.rookie)));
  csv("rookies_first_change", { method: name, n: pm.n, price_mae: Math.round(pm.value) });
  console.log(`  ${name.padEnd(28)} n=${pm.n}  ${money(pm.value)}`);
}
for (const v of PRE_DEBUT) {
  const r = get(`pre:${v}`);
  const pm = mae(r.price, firstChange);
  const sm = mae(r.score);
  csv("rookies_first_change", { method: `pre-debut fixed ${v}`, n: pm.n, price_mae: Math.round(pm.value), score_mae: fmt(sm.value), score_n: sm.n });
  console.log(`  pre-debut fixed ${v}            n=${pm.n}  ${money(pm.value)}  (score MAE ${fmt(sm.value)} over ${sm.n})`);
}

const rookieBoot = pairedBootstrap(get(bestRookie).price, get("rook:own_average").price, () => true);
const rookieScoreBoot = pairedBootstrap(get(bestRookie).score, get("rook:own_average").score, () => true);
const lastBoot = pairedBootstrap(get("rook:last_score").price, get("rook:own_average").price, () => true);
console.log(`\nBootstrap ${bestRookie} vs own average (all origins, includes the rounds used to choose it): price ${signedMoney(rookieBoot.diff)} [${signedMoney(rookieBoot.lo)}, ${signedMoney(rookieBoot.hi)}] over ${rookieBoot.players} players -> ${verdict(rookieBoot)}; score ${fmt(rookieScoreBoot.diff)} [${fmt(rookieScoreBoot.lo)}, ${fmt(rookieScoreBoot.hi)}] -> ${verdict(rookieScoreBoot)}`);
console.log(`Bootstrap last score vs own average: price ${signedMoney(lastBoot.diff)} [${signedMoney(lastBoot.lo)}, ${signedMoney(lastBoot.hi)}] -> ${verdict(lastBoot)}`);
const rookieOos = pairedBootstrap(get(bestRookie).price, get("rook:own_average").price, outSample);
console.log(`Out-of-sample only (12-17): ${signedMoney(rookieOos.diff)} [${signedMoney(rookieOos.lo)}, ${signedMoney(rookieOos.hi)}] over ${rookieOos.players} players -> ${verdict(rookieOos)}`);

// Rookies whose first score was 90+: what came next.
const bigStarts = [...debutants]
  .map((pid) => actualById.get(pid)!.history.filter((h) => h.games > 0).map((h) => h.score as number))
  .filter((scores) => scores.length >= 1 && scores[0] >= 90);
const nextScores = bigStarts.filter((s) => s.length >= 2).map((s) => s[1]);
console.log(`\nDebutants whose first score was 90+: ${bigStarts.length}. Next score (${nextScores.length} with a 2nd game): ${[...nextScores].sort((a, b) => a - b).join(", ")}`);
console.log(`  first-score mean ${fmt(mean(bigStarts.map((s) => s[0])))}; next-score mean ${fmt(mean(nextScores))}, median ${fmt(median(nextScores))}, quartiles ${fmt(quantile(nextScores, 0.25))}-${fmt(quantile(nextScores, 0.75))}; games 2-5 mean ${fmt(mean(bigStarts.flatMap((s) => s.slice(1, 5))))}`);
for (const s of bigStarts) csv("rookies_big_first_score", { first: s[0], next: s[1] ?? "", games_2_to_5: s.slice(1, 5).join(" ") });

// ---------------------------------------------------------------------------
// 4. Matchups (on top of the best base; params on 5-11, test 12-17)
// ---------------------------------------------------------------------------

console.log("\n=== 4. MATCHUP EFFECTS ===");

const baseProject = (ctx: OriginContext, s: PlayerState) => {
  if (s.rookie) {
    if (s.scores.length === 0) return 50;
    const [b, st] = bestRookie.replace("rook:trust_b", "").split("_s").map(Number);
    return trustProjection(s.scores, ctx.typicalRookie, b, st);
  }
  const m = GENERAL_METHODS.find((x) => `gen:${x.name}` === bestGeneral)!;
  return s.scores.length ? m.project(s.scores) : null;
};

const K_TEAM = [10, 20, 40, 80];
const K_PLAYER: (number | null)[] = [null, 3, 6, 12];
const matchupResults = new Map<string, Result>();
const addM = (name: string, score: Obs[], price: Obs[]) => {
  const r = matchupResults.get(name) ?? { score: [], price: [] };
  r.score.push(...score);
  r.price.push(...price);
  matchupResults.set(name, r);
};

for (const ctx of contexts) {
  const model = buildMatchups(ctx);
  const states = [...ctx.states.values()].filter((s) => s.scores.length >= 1 || s.rookie);

  // Pair counts: targets (played) where he has already met that opponent.
  let targets = 0;
  let withPrior = 0;
  for (const s of states) {
    for (const h of HORIZONS) {
      const target = ctx.origin + h;
      if (target > FINAL_ROUND || !playedRound(s.id, target)) continue;
      targets += 1;
      const opp = opponentOf.get(`${target}:${s.team}`);
      if (opp && s.opponents.includes(opp)) withPrior += 1;
    }
  }
  pairCounts.push({ origin: ctx.origin, targets, withPriorMeeting: withPrior, pairs: model.playerOpp.size });

  const make = (kTeam: number | null, kPlayer: number | null): Projections => {
    const out: Projections = new Map();
    for (const s of states) {
      const b = baseProject(ctx, s);
      const byRound = new Map<number, number | null>();
      for (const h of HORIZONS) {
        const target = ctx.origin + h;
        if (target > FINAL_ROUND) continue;
        const opp = opponentOf.get(`${target}:${s.team}`);
        if (!opp || b === null) {
          byRound.set(target, null);
          continue;
        }
        const adj = kTeam === null ? 0 : matchupAdjustment(model, s, opp, kTeam, kPlayer);
        byRound.set(target, Math.max(0, b + adj));
      }
      out.set(s.id, byRound);
    }
    return out;
  };

  const none = make(null, null);
  addM("base", scoreObs(ctx, none), priceObs(ctx, none));
  for (const kt of K_TEAM) {
    for (const kp of K_PLAYER) {
      const proj = make(kt, kp);
      addM(`team_k${kt}_player_${kp ?? "off"}`, scoreObs(ctx, proj), priceObs(ctx, proj));
    }
  }
}

console.log("(player, opponent) meetings: targets with a prior meeting this season, by origin:");
for (const p of pairCounts) {
  console.log(`  O=${p.origin}: ${p.withPriorMeeting} of ${p.targets} played targets (${fmt((100 * p.withPriorMeeting) / Math.max(p.targets, 1))}%); distinct pairs so far ${p.pairs}`);
  csv("matchup_pairs", p);
}

let bestM = "";
let bestMValue = Infinity;
for (const [name, r] of matchupResults) {
  if (name === "base") continue;
  const v = mae(r.price, inSample).value;
  if (v < bestMValue) {
    bestMValue = v;
    bestM = name;
  }
}
const mBase = matchupResults.get("base")!;
const mBest = matchupResults.get(bestM)!;
console.log(`\nChosen on 5-11: ${bestM}. Out-of-sample (12-17), with vs without:`);
const mSegments: [string, Filter][] = [
  ["overall", () => true],
  ["premium >600k", seg((s) => s.price > 600_000)],
  ["RUC", seg((s) => s.position === "RUC")],
];
for (const [label, f] of mSegments) {
  const filter = both(outSample, f);
  const pb = pairedBootstrap(mBest.price, mBase.price, filter);
  const sb = pairedBootstrap(mBest.score, mBase.score, filter);
  const row = {
    segment: label,
    score_mae_without: fmt(mae(mBase.score, filter).value),
    score_mae_with: fmt(mae(mBest.score, filter).value),
    score_diff: fmt(sb.diff, 2),
    score_ci: `${fmt(sb.lo, 2)} to ${fmt(sb.hi, 2)}`,
    price_mae_without: Math.round(mae(mBase.price, filter).value),
    price_mae_with: Math.round(mae(mBest.price, filter).value),
    price_diff: Math.round(pb.diff),
    price_ci: `${Math.round(pb.lo)} to ${Math.round(pb.hi)}`,
    verdict: verdict(pb),
  };
  csv("matchups", row);
  console.log(`  ${label.padEnd(14)} score ${row.score_mae_without} -> ${row.score_mae_with} (${row.score_diff} [${row.score_ci}]) ${verdict(sb)}; price ${money(row.price_mae_without)} -> ${money(row.price_mae_with)} (${signedMoney(pb.diff)} [${signedMoney(pb.lo)}, ${signedMoney(pb.hi)}]) ${verdict(pb)}`);
}

// ---------------------------------------------------------------------------
// 5. Composite vs plain average, by horizon (the deliverable numbers)
// ---------------------------------------------------------------------------

console.log("\n=== COMPOSITE (best per segment) vs PLAIN AVERAGE, out-of-sample price MAE ===");
// Composite = matchup "base" run (best rookie rule + best general method).
// Plain average for everyone (rookies included), from the same states.
const plainResults: Result = { score: [], price: [] };
for (const ctx of contexts) {
  const proj = flat(ctx, (s) => (s.scores.length ? mean(s.scores) : null), (s) => s.scores.length >= 1 || s.rookie);
  plainResults.score.push(...scoreObs(ctx, proj));
  plainResults.price.push(...priceObs(ctx, proj));
}
const compSegments: [string, Filter][] = [
  ["all", () => true],
  ["rookies (all)", seg((s) => s.rookie)],
  ["rookies before debut", seg((s) => s.rookie && s.gamesN === 0)],
  ["rookies after debut", seg((s) => s.rookie && s.gamesN >= 1)],
  ["mid-range 300-600k", seg((s) => !s.rookie && s.price >= 300_000 && s.price <= 600_000)],
  ["premiums >600k", seg((s) => !s.rookie && s.price > 600_000)],
  ["cheap non-rookies <300k", seg((s) => !s.rookie && s.price < 300_000)],
];
for (const [label, f] of compSegments) {
  for (const h of HORIZONS) {
    const filter = both(outSample, f, horizon(h));
    const a = mae(plainResults.price, filter);
    const b = mae(mBase.price, filter);
    const boot = pairedBootstrap(mBase.price, plainResults.price, filter);
    csv("composite_vs_plain", { segment: label, horizon: h, n: a.n, plain_price_mae: Math.round(a.value), composite_price_mae: Math.round(b.value), diff: Math.round(boot.diff), lo: Math.round(boot.lo), hi: Math.round(boot.hi), verdict: verdict(boot) });
    console.log(`  ${label.padEnd(24)} +${h}: n=${String(a.n).padStart(5)} ${money(a.value)} -> ${money(b.value)}  ${signedMoney(boot.diff)} [${signedMoney(boot.lo)}, ${signedMoney(boot.hi)}] ${verdict(boot)}`);
  }
}

// ---------------------------------------------------------------------------
// Playing assumption and 2027 preparation
// ---------------------------------------------------------------------------

console.log("\n=== PLAYING ASSUMPTION ===");
console.log(`Projected to play (team has a game and he played his team's last game): ${projectedToPlay.projected}; didn't play: ${projectedToPlay.didNotPlay} (${fmt((100 * projectedToPlay.didNotPlay) / projectedToPlay.projected)}%).`);

console.log("\n=== 7. 2027 DATA PREPARATION ===");
const pairsSeason = new Set<string>();
for (const p of allPlayers) {
  for (const h of p.history) if (h.games > 0 && h.opponent) pairsSeason.add(`${p.championDataId}:${h.opponent}`);
}
const playersWithFeed = allPlayers.filter((p) => p.championDataId).length;
console.log(`Detail files: ${detailFiles}; with feed_id: ${withFeedId}. Normalised players with championDataId: ${playersWithFeed} of ${allPlayers.length}.`);
console.log(`2026 (player, opponent) pairs with a game: ${pairsSeason.size}. Players with 2025 totals (linked through feed_id in the same record): ${with2025Totals}.`);

// ---------------------------------------------------------------------------
// CSV output
// ---------------------------------------------------------------------------

await mkdir(OUTPUT_DIR, { recursive: true });
for (const [name, rows] of Object.entries(csvRows)) {
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  await writeFile(
    path.join(OUTPUT_DIR, `backtest-projections-${name}.csv`),
    [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(","))].join("\n"),
  );
}
console.log(`\nCSVs written to scripts/output/backtest-projections-*.csv (${Object.keys(csvRows).length} files).`);
console.log(`Rookie methods tested: ${rookieMethods.length}; general methods: ${GENERAL_METHODS.length}; matchup variants: ${matchupResults.size - 1}.`);
