/**
 * Shared pieces of the research backtests (scripts/backtest-projections.ts
 * and scripts/backtest-matchups.ts): local data, as-of origins, the
 * played and price-eligible filters, the planner price path, metrics,
 * the paired player bootstrap and CSV output. Load it with a dynamic
 * import after registering the module hooks (see either script).
 */

import { readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { trimPlayersToRound } from "../../lib/asOf/trimToRound";
import { estimateScaledRoundContexts } from "../../lib/priceEngine/estimateScaledRoundContexts";
import { BASE_MAGIC_NUMBER_2026 } from "../../lib/priceEngine/baseMagicNumber";
import { createPriceProjector } from "../../lib/planner/pricePaths";
import type { Player } from "../../types/player";



export type RawFixtureFile = Parameters<typeof trimPlayersToRound>[1];

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const ORIGINS = Array.from({ length: 13 }, (_, i) => 5 + i); // 5..17
export const IN_SAMPLE = new Set(ORIGINS.filter((o) => o <= 11)); // 5..11
export const OUT_SAMPLE = new Set(ORIGINS.filter((o) => o >= 12)); // 12..17
export const HORIZONS = [1, 2, 3];
export const FINAL_ROUND = 24;
export const ROOKIE_MAX_GAMES = 5;
export const BOOTSTRAP_SAMPLES = 1000;
export const OUTPUT_DIR = path.resolve("scripts/output");

// ---------------------------------------------------------------------------
// Data (local files only)
// ---------------------------------------------------------------------------

export const allPlayers = JSON.parse(
  readFileSync(path.resolve("data/2026/players-normalised.json"), "utf8"),
) as Player[];
export const fixtureFile = JSON.parse(
  readFileSync(path.resolve("data/2026/fixtures-raw.json"), "utf8"),
) as RawFixtureFile;

export const actualById = new Map(allPlayers.map((p) => [p.id, p]));

// Opponent for a team in a round, from the published schedule (known in
// advance, so not leakage).
export const opponentOf = new Map<string, string>();
export const teamPlays = new Set<string>();
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
export const plannerFixtures = fixtureFile.rounds.flatMap((round) =>
  round.response.map((game) => ({
    round: round.round,
    homeTeam: (game.team1 as { abbrev: string }).abbrev,
    awayTeam: (game.team2 as { abbrev: string }).abbrev,
  })),
);

// 2026 debutants: no 2025 games (previous_games is read only to define the
// sample) and at least one 2026 game. Also feed_id coverage for section 7.
export const detailsDir = path.resolve("data/2026/player-details");
export const debutants = new Set<number>();
export let detailFiles = 0;
export let withFeedId = 0;
export let with2025Totals = 0;
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

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : NaN);
export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo);
};
/** Spread of the player's scores around his own median. */
export const sdAroundMedian = (xs: number[]) => {
  const m = median(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
export const winsorise = (xs: number[]) => {
  const m = median(xs);
  const sd = sdAroundMedian(xs);
  return xs.map((x) => Math.min(m + 1.5 * sd, Math.max(m - 1.5 * sd, x)));
};
/** Exponentially weighted average; the latest score has age 0. */
export const ewma = (xs: number[], halfLife: number) => {
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
export const hadOutlier = (xs: number[]) => {
  if (xs.length < 3) return false;
  const m = median(xs);
  const sd = sdAroundMedian(xs);
  return sd > 0 && xs.slice(-3).some((x) => Math.abs(x - m) > 1.5 * sd);
};


// ---------------------------------------------------------------------------
// Per-origin context
// ---------------------------------------------------------------------------

export type PlayerState = {
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

export type OriginContext = {
  origin: number;
  trimmed: Player[];
  states: Map<number, PlayerState>;
  contexts: ReturnType<typeof estimateScaledRoundContexts>;
  typicalRookie: number;
};

export function buildOrigin(origin: number): OriginContext {
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

export type Obs = {
  origin: number;
  h: number;
  pid: number;
  err: number; // projected minus actual
};

export const actualRow = (pid: number, round: number) =>
  actualById.get(pid)?.history.find((h) => h.round === round);

export const playedRound = (pid: number, round: number) => {
  const row = actualRow(pid, round);
  return !!row && row.games > 0 && row.score !== null;
};

/**
 * Price at O+h is scored when the player played every round from O+1 to
 * O+h in which his team had a game (so the price path's "he plays"
 * assumption held) and played O+h itself.
 */
export function priceEligible(state: PlayerState, origin: number, target: number) {
  for (let r = origin + 1; r <= target; r++) {
    if (teamPlays.has(`${r}:${state.team}`) && !playedRound(state.id, r)) return false;
  }
  return playedRound(state.id, target);
}

/** Projected score per player per target round (null = not projected). */
export type Projections = Map<number, Map<number, number | null>>;

export function scoreObs(ctx: OriginContext, projections: Projections): Obs[] {
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

export function priceObs(ctx: OriginContext, projections: Projections, only?: Set<number>): Obs[] {
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
export function flat(ctx: OriginContext, value: (s: PlayerState) => number | null, filter: (s: PlayerState) => boolean): Projections {
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


export const segmentOf = new Map<string, { band: string; games: string; position: string; outlier: boolean; price: number; rookie: boolean; gamesN: number }>();
export const band = (price: number) =>
  price < 300_000 ? "<300k" : price < 500_000 ? "300-500k" : price < 700_000 ? "500-700k" : ">700k";
export const gamesBand = (g: number) => (g <= 5 ? "1-5" : g <= 10 ? "6-10" : "11+");

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export type Filter = (o: Obs) => boolean;
export const inSample: Filter = (o) => IN_SAMPLE.has(o.origin);
export const outSample: Filter = (o) => OUT_SAMPLE.has(o.origin);
export const horizon = (h: number): Filter => (o) => o.h === h;
export const both = (...fs: Filter[]): Filter => (o) => fs.every((f) => f(o));
export const seg = (pick: (s: NonNullable<ReturnType<typeof segmentOf.get>>) => boolean): Filter => (o) => {
  const s = segmentOf.get(`${o.origin}:${o.pid}`);
  return !!s && pick(s);
};

export const mae = (obs: Obs[], f: Filter = () => true) => {
  const xs = obs.filter(f).map((o) => Math.abs(o.err));
  return { value: mean(xs), n: xs.length };
};
export const bias = (obs: Obs[], f: Filter = () => true) => mean(obs.filter(f).map((o) => o.err));

/** Per-origin MAE spread (min, max) on a filter. */
export const spread = (obs: Obs[], f: Filter) => {
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
export function pairedBootstrap(method: Obs[], baseline: Obs[], f: Filter) {
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

export const fmt = (x: number, digits = 1) => (Number.isFinite(x) ? x.toFixed(digits) : "-");
export const money = (x: number) => (Number.isFinite(x) ? `$${Math.round(x).toLocaleString("en-AU")}` : "-");
export const signedMoney = (x: number) => (Number.isFinite(x) ? `${x < 0 ? "−" : "+"}$${Math.abs(Math.round(x)).toLocaleString("en-AU")}` : "-");
export const verdict = (b: { lo: number; hi: number }) =>
  !Number.isFinite(b.lo) ? "too few players" : b.hi < 0 ? "better (beyond noise)" : b.lo > 0 ? "worse (beyond noise)" : "within noise";

export const csvRows: Record<string, Record<string, string | number>[]> = {};
export const csv = (name: string, row: Record<string, string | number>) => (csvRows[name] ??= []).push(row);

/** Writes every CSV collected with csv() to scripts/output/{prefix}-{name}.csv. */
export async function writeCsvs(prefix: string): Promise<number> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const [name, rows] of Object.entries(csvRows)) {
    const headers = Object.keys(rows[0]);
    const escape = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    await writeFile(
      path.join(OUTPUT_DIR, `${prefix}-${name}.csv`),
      [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(","))].join("\n"),
    );
  }
  return Object.keys(csvRows).length;
}
