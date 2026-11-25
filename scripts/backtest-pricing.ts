/**
 * Backtest of the SuperCoach 2026 pricing model.
 *
 * Compares the current model (fixed 0.75 weight, per-round fitted MN)
 * with the "scaled" hypothesis:
 *
 *   raw_i      = 0.75 * oldPrice_i + 0.25 * baseMN * threeRoundAvg_i
 *   k          = anchorTotal / sum(raw)
 *   newPrice_i = round(k * raw_i)
 *
 * Ground truth is ONLY the published prices and scores in
 * data/2026/players-complete.json. The "Official MN" on /magic-number
 * is never used.
 *
 * Run with:  node scripts/backtest-pricing.ts
 * (Node 24 strips the TypeScript types natively; no extra dependencies.)
 *
 * Output: console tables plus CSV files in scripts/output/.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as nodeModule from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Player, PlayerHistoryRow } from "@/types/player";
import type { SuperCoachPlayer } from "@/types/supercoach";

const SEASON = 2026;
const ROOT = process.cwd();

const PLAYERS_FILE = path.resolve(
  `data/${SEASON}/players-complete.json`,
);

const OUTPUT_DIRECTORY = path.resolve("scripts/output");

/** First round of the post-draft period (mid-season draftees added). */
const DRAFT_ROUND = 11;

// ---------------------------------------------------------------------------
// Module resolution
//
// The lib/ files use extensionless relative imports and the "@/" alias
// (bundler resolution). Node does not understand either, so register a tiny
// resolve hook before dynamically importing the existing project code.
// ---------------------------------------------------------------------------

type ResolveHook = (
  specifier: string,
  context: { parentURL?: string },
  nextResolve: (
    specifier: string,
    context: { parentURL?: string },
  ) => unknown,
) => unknown;

const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = specifier;

    if (target.startsWith("@/")) {
      target = pathToFileURL(
        path.join(ROOT, target.slice(2)),
      ).href;
    }

    const isLocal =
      target.startsWith(".") || target.startsWith("file:");

    if (isLocal && !path.extname(target) && context.parentURL) {
      const filePath = fileURLToPath(
        new URL(target, context.parentURL),
      );

      for (const extension of [".ts", ".tsx"]) {
        if (existsSync(filePath + extension)) {
          return nextResolve(
            pathToFileURL(filePath + extension).href,
            context,
          );
        }
      }
    }

    return nextResolve(target, context);
  },
});

const { roundPriceUp } = await import(
  "../lib/priceEngine/roundPrice"
);
const { getLastThreeScores } = await import(
  "../lib/priceEngine/getLastThreeScores"
);
const { solveMagicNumber } = await import(
  "../lib/priceEngine/solveMagicNumber"
);
const { normaliseSuperCoachPlayer } = await import(
  "../lib/supercoach/normalisePlayer"
);

// ---------------------------------------------------------------------------
// Data loading (same normalisation and ordering as lib/players.ts)
// ---------------------------------------------------------------------------

type RawPlayer = SuperCoachPlayer & { previous_games?: number };

async function loadPlayers(): Promise<{
  players: Player[];
  previousGames: Map<number, number>;
}> {
  const rawPlayers = JSON.parse(
    await readFile(PLAYERS_FILE, "utf8"),
  ) as RawPlayer[];

  const previousGames = new Map<number, number>();
  const players: Player[] = [];

  for (const rawPlayer of rawPlayers) {
    previousGames.set(
      rawPlayer.id,
      Number(rawPlayer.previous_games ?? 0),
    );

    try {
      players.push(normaliseSuperCoachPlayer(rawPlayer));
    } catch (error) {
      console.warn(
        `Could not normalise player ${rawPlayer.id}:`,
        error,
      );
    }
  }

  players.sort((a, b) => a.name.localeCompare(b.name));

  return { players, previousGames };
}

// ---------------------------------------------------------------------------
// Per-round player rows
// ---------------------------------------------------------------------------

type Category =
  /** Eligible under the existing evaluateMagicNumber rules. */
  | "eligible"
  /** Played this round but has fewer than 3 scores. */
  | "under3"
  /** Did not play this round. */
  | "didNotPlay";

interface RoundRow {
  player: Player;
  oldPrice: number;
  actualPrice: number;
  category: Category;
  /** Three-round average; only set for eligible players. */
  threeRoundAverage: number;
  priceChanged: boolean;
  gamesToDate: number;
  teamHadByeLastRound: boolean;
  missedLastRoundNotBye: boolean;
  debutant: boolean;
}

interface RoundData {
  round: number;
  rows: RoundRow[];
  /** Sum of all published prices in the previous round. */
  previousTotal: number;
  /** Sum of all published prices in this round. */
  actualTotal: number;
  /** Players with a published price this round but not last round. */
  entrants: { player: Player; price: number }[];
}

function historyRow(
  player: Player,
  round: number,
): PlayerHistoryRow | undefined {
  return player.history.find((row) => row.round === round);
}

/**
 * Mirrors the eligibility checks inside evaluateMagicNumber, which are not
 * exported: price in both rounds, a score this round, and at least three
 * scores to date (getLastThreeScores).
 */
function buildRoundData(
  players: Player[],
  previousGames: Map<number, number>,
  round: number,
): RoundData {
  const teamsPlayedLastRound = new Set<string>();

  for (const player of players) {
    if ((historyRow(player, round - 1)?.games ?? 0) > 0) {
      teamsPlayedLastRound.add(player.team);
    }
  }

  const rows: RoundRow[] = [];
  const entrants: RoundData["entrants"] = [];
  let previousTotal = 0;
  let actualTotal = 0;

  for (const player of players) {
    const previous = historyRow(player, round - 1);
    const current = historyRow(player, round);

    if (current?.price != null) {
      actualTotal += current.price;
    }

    if (previous?.price != null) {
      previousTotal += previous.price;
    }

    if (!current || current.price == null) {
      continue;
    }

    if (!previous || previous.price == null) {
      entrants.push({ player, price: current.price });
      continue;
    }

    const lastThree = getLastThreeScores(player.history, round);
    const played = current.score !== null;

    let category: Category = "didNotPlay";

    if (played) {
      category = lastThree === null ? "under3" : "eligible";
    }

    const gamesToDate = player.history.filter(
      (row) => row.round <= round && row.score !== null,
    ).length;

    const teamHadBye =
      round - 1 >= 0 && !teamsPlayedLastRound.has(player.team);

    rows.push({
      player,
      oldPrice: previous.price,
      actualPrice: current.price,
      category,
      threeRoundAverage:
        lastThree === null
          ? 0
          : (lastThree[0] + lastThree[1] + lastThree[2]) / 3,
      priceChanged: current.price !== previous.price,
      gamesToDate,
      teamHadByeLastRound: teamHadBye,
      missedLastRoundNotBye:
        !teamHadBye && previous.score === null,
      debutant: (previousGames.get(player.id) ?? 0) === 0,
    });
  }

  return { round, rows, previousTotal, actualTotal, entrants };
}

// ---------------------------------------------------------------------------
// Rounding
// ---------------------------------------------------------------------------

type RoundingMode = "ceil100" | "nearest100";

const ROUNDERS: Record<RoundingMode, (value: number) => number> = {
  /** Existing lib/priceEngine/roundPrice.ts behaviour. */
  ceil100: roundPriceUp,
  nearest100: (value) => Math.round(value / 100) * 100,
};

// ---------------------------------------------------------------------------
// Part 1: baseline (current model)
// ---------------------------------------------------------------------------

function currentModelPrice(row: RoundRow, magicNumber: number): number {
  return roundPriceUp(
    (row.oldPrice * 3 + row.threeRoundAverage * magicNumber) / 4,
  );
}

// ---------------------------------------------------------------------------
// Part 3: scaled model variants
// ---------------------------------------------------------------------------

type Under3Mode =
  /** (A) frozen at old price and excluded from the pool and scaling. */
  | "A-frozen"
  /** (B) multiplied by k with everyone else (raw = old price). */
  | "B-scaled";

type PoolMode =
  /** (1) all priced players, including those who did not play. */
  | "1-all"
  /** (2) only players who played this round. */
  | "2-played"
  /** (3) only players whose published price changed this round. */
  | "3-changed";

type AnchorMode =
  /** (X) previous round's actual total. */
  | "X-prevRound"
  /** (Y) period-start total plus later entrants' prices. */
  | "Y-periodStart";

interface Variant {
  id: string;
  under3: Under3Mode;
  pool: PoolMode;
  anchor: AnchorMode;
  rounding: RoundingMode;
}

const VARIANTS: Variant[] = [];

for (const under3 of ["A-frozen", "B-scaled"] as const) {
  for (const pool of ["1-all", "2-played", "3-changed"] as const) {
    for (const anchor of ["X-prevRound", "Y-periodStart"] as const) {
      for (const rounding of ["ceil100", "nearest100"] as const) {
        VARIANTS.push({
          id: `${under3[0]}${pool[0]}${anchor[0]}-${rounding}`,
          under3,
          pool,
          anchor,
          rounding,
        });
      }
    }
  }
}

function isScaled(row: RoundRow, variant: Variant): boolean {
  if (row.category === "eligible") {
    return true;
  }

  return row.category === "under3" && variant.under3 === "B-scaled";
}

function isInPool(row: RoundRow, variant: Variant): boolean {
  if (row.category === "under3" && variant.under3 === "A-frozen") {
    return false;
  }

  switch (variant.pool) {
    case "1-all":
      return true;
    case "2-played":
      return row.category !== "didNotPlay";
    case "3-changed":
      return row.priceChanged;
  }
}

function rawPrice(row: RoundRow, baseMN: number): number {
  if (row.category !== "eligible") {
    return row.oldPrice;
  }

  return 0.75 * row.oldPrice + 0.25 * baseMN * row.threeRoundAverage;
}

interface ScaledRoundResult {
  round: number;
  k: number;
  anchorTotal: number;
  predictedTotal: number;
  actualTotal: number;
  /** Predictions for every row, same order as RoundData.rows. */
  predictions: number[];
  eligibleError: number;
  eligibleCount: number;
  allError: number;
  allCount: number;
}

/**
 * anchorTotal is the target value of every player priced last round.
 * The pool's share is anchorTotal minus the old prices of players outside
 * the pool, and k = poolShare / sum(raw over the pool), where players in the
 * pool who are not scaled contribute their old price as their raw value.
 * k is applied only to scaled players.
 */
function runScaledRound(
  data: RoundData,
  variant: Variant,
  baseMN: number,
  anchorTotal: number,
): ScaledRoundResult {
  const round = ROUNDERS[variant.rounding];

  let poolShare = anchorTotal;
  let poolRawSum = 0;

  for (const row of data.rows) {
    if (isInPool(row, variant)) {
      poolRawSum += isScaled(row, variant)
        ? rawPrice(row, baseMN)
        : row.oldPrice;
    } else {
      poolShare -= row.oldPrice;
    }
  }

  const k = poolRawSum === 0 ? 1 : poolShare / poolRawSum;

  const predictions: number[] = [];
  let predictedTotal = 0;
  let eligibleError = 0;
  let eligibleCount = 0;
  let allError = 0;

  for (const row of data.rows) {
    const predicted = isScaled(row, variant)
      ? round(k * rawPrice(row, baseMN))
      : row.oldPrice;

    const error = Math.abs(predicted - row.actualPrice);

    predictions.push(predicted);
    predictedTotal += predicted;
    allError += error;

    if (row.category === "eligible") {
      eligibleError += error;
      eligibleCount += 1;
    }
  }

  for (const entrant of data.entrants) {
    predictedTotal += entrant.price;
  }

  return {
    round: data.round,
    k,
    anchorTotal,
    predictedTotal,
    actualTotal: data.actualTotal,
    predictions,
    eligibleError,
    eligibleCount,
    allError,
    allCount: data.rows.length,
  };
}

// ---------------------------------------------------------------------------
// Periods and anchors
// ---------------------------------------------------------------------------

interface Period {
  label: string;
  rounds: RoundData[];
  /**
   * (Y) anchor per round: period-start total plus the prices of players
   * who entered during the period before that round.
   */
  periodStartAnchors: Map<number, number>;
}

function buildPeriod(
  label: string,
  rounds: RoundData[],
  startTotal: number,
): Period {
  const periodStartAnchors = new Map<number, number>();
  let anchor = startTotal;

  for (const data of rounds) {
    periodStartAnchors.set(data.round, anchor);

    for (const entrant of data.entrants) {
      anchor += entrant.price;
    }
  }

  return { label, rounds, periodStartAnchors };
}

function anchorFor(
  period: Period,
  data: RoundData,
  variant: Variant,
): number {
  return variant.anchor === "X-prevRound"
    ? data.previousTotal
    : (period.periodStartAnchors.get(data.round) as number);
}

function runPeriod(
  period: Period,
  variant: Variant,
  baseMN: number,
): ScaledRoundResult[] {
  return period.rounds.map((data) =>
    runScaledRound(
      data,
      variant,
      baseMN,
      anchorFor(period, data, variant),
    ),
  );
}

function pooledError(results: ScaledRoundResult[]): number {
  let error = 0;
  let count = 0;

  for (const result of results) {
    error += result.eligibleError;
    count += result.eligibleCount;
  }

  return count === 0 ? 0 : error / count;
}

/** Coarse-to-fine grid search for ONE baseMN covering the whole period. */
function fitBaseMN(
  periods: Period[],
  variant: Variant,
): { baseMN: number; error: number } {
  const evaluate = (baseMN: number) =>
    pooledError(
      periods.flatMap((period) => runPeriod(period, variant, baseMN)),
    );

  let best = { baseMN: 0, error: Number.POSITIVE_INFINITY };

  const search = (start: number, end: number, step: number) => {
    const steps = Math.round((end - start) / step);

    for (let index = 0; index <= steps; index++) {
      const baseMN = Number((start + index * step).toFixed(4));
      const error = evaluate(baseMN);

      if (error < best.error) {
        best = { baseMN, error };
      }
    }
  };

  search(3000, 8000, 10);
  const coarse = best.baseMN;
  search(coarse - 10, coarse + 10, 1);
  const integer = best.baseMN;
  search(integer - 1, integer + 1, 0.05);

  return best;
}

// ---------------------------------------------------------------------------
// Part 2: regression diagnostic
// ---------------------------------------------------------------------------

/** Least squares newPrice = a * oldPrice + b * avg3 (no intercept). */
function regress(rows: RoundRow[]) {
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  let sxp = 0;
  let syp = 0;

  for (const row of rows) {
    const x = row.oldPrice;
    const y = row.threeRoundAverage;
    const p = row.actualPrice;

    sxx += x * x;
    sxy += x * y;
    syy += y * y;
    sxp += x * p;
    syp += y * p;
  }

  const determinant = sxx * syy - sxy * sxy;
  const a = (sxp * syy - syp * sxy) / determinant;
  const b = (syp * sxx - sxp * sxy) / determinant;

  const residuals = rows.map(
    (row) =>
      row.actualPrice - (a * row.oldPrice + b * row.threeRoundAverage),
  );

  const meanResidual =
    residuals.reduce((total, value) => total + value, 0) /
    residuals.length;
  const meanAbsResidual =
    residuals.reduce((total, value) => total + Math.abs(value), 0) /
    residuals.length;
  const rmse = Math.sqrt(
    residuals.reduce((total, value) => total + value * value, 0) /
      residuals.length,
  );
  const maxAbsResidual = Math.max(...residuals.map(Math.abs));

  return { a, b, meanResidual, meanAbsResidual, rmse, maxAbsResidual };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const money = (value: number) =>
  `$${Math.round(value).toLocaleString("en-AU")}`;

const fixed = (value: number, digits: number) => value.toFixed(digits);

function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
}

function scoreHistory(player: Player, round: number): string {
  return player.history
    .filter((row) => row.round <= round && row.round >= round - 5)
    .map((row) => `R${row.round}:${row.score ?? "-"}`)
    .join(" ");
}

function section(title: string) {
  console.log("");
  console.log(title);
  console.log("-".repeat(title.length));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`SuperCoach ${SEASON} pricing backtest`);
  console.log("----------------------------------");

  const { players, previousGames } = await loadPlayers();

  const lastScoredRound = Math.max(
    ...players.flatMap((player) =>
      player.history
        .filter((row) => row.score !== null)
        .map((row) => row.round),
    ),
  );

  const allRounds: RoundData[] = [];

  for (let round = 2; round <= lastScoredRound; round++) {
    allRounds.push(buildRoundData(players, previousGames, round));
  }

  // ---- Data overview ------------------------------------------------------
  section("Data overview");

  console.table(
    allRounds.map((data) => ({
      round: data.round,
      priced: data.rows.length + data.entrants.length,
      entrants: data.entrants.length,
      eligible: data.rows.filter((r) => r.category === "eligible").length,
      under3: data.rows.filter((r) => r.category === "under3").length,
      didNotPlay: data.rows.filter((r) => r.category === "didNotPlay")
        .length,
      changed: data.rows.filter((r) => r.priceChanged).length,
      changedNotEligible: data.rows.filter(
        (r) => r.priceChanged && r.category !== "eligible",
      ).length,
      eligibleUnchanged: data.rows.filter(
        (r) => !r.priceChanged && r.category === "eligible",
      ).length,
      actualTotal: money(data.actualTotal),
      totalChange: money(data.actualTotal - data.previousTotal),
    })),
  );

  // ---- Part 1: baseline ---------------------------------------------------
  section("Part 1: baseline (fixed 0.75 weight, per-round fitted MN)");

  const baselineRows: Record<string, string | number>[] = [];
  const baselineByRound = new Map<number, { error: number; n: number }>();
  const originalLog = console.log;

  for (const data of allRounds) {
    // evaluateMagicNumber logs a debug history line; silence it here.
    console.log = () => {};
    const solved = solveMagicNumber(players, data.round);
    console.log = originalLog;

    if (!solved) {
      continue;
    }

    // Cross-check the mirrored eligibility against the existing solver.
    const eligible = data.rows.filter((r) => r.category === "eligible");
    const ownError =
      eligible.reduce(
        (total, row) =>
          total +
          Math.abs(
            currentModelPrice(row, solved.magicNumber) - row.actualPrice,
          ),
        0,
      ) / eligible.length;

    baselineByRound.set(data.round, {
      error: solved.averagePriceError,
      n: solved.playersCompared,
    });

    baselineRows.push({
      round: data.round,
      solvedMN: fixed(solved.magicNumber, 2),
      players: solved.playersCompared,
      avgError: money(solved.averagePriceError),
      maxError: money(solved.maxPriceError),
      crossCheckPlayers: eligible.length,
      crossCheckAvgError: money(ownError),
    });
  }

  console.table(baselineRows);

  const baselinePeriodError = (from: number, to: number) => {
    let error = 0;
    let n = 0;

    for (const [round, value] of baselineByRound) {
      if (round >= from && round <= to) {
        error += value.error * value.n;
        n += value.n;
      }
    }

    return n === 0 ? 0 : error / n;
  };

  const baselineP1 = baselinePeriodError(2, DRAFT_ROUND - 1);
  const baselineP2 = baselinePeriodError(DRAFT_ROUND, lastScoredRound);
  const baselineAll = baselinePeriodError(2, lastScoredRound);

  console.log(
    `Baseline pooled error: R2-${DRAFT_ROUND - 1} ${money(baselineP1)}, ` +
      `R${DRAFT_ROUND}-${lastScoredRound} ${money(baselineP2)}, ` +
      `all ${money(baselineAll)}`,
  );

  // ---- Part 2: regression -------------------------------------------------
  section("Part 2: regression newPrice = a*oldPrice + b*threeRoundAvg");

  const regressionRows = allRounds.map((data) => {
    const eligible = data.rows.filter((r) => r.category === "eligible");
    const fit = regress(eligible);

    return {
      round: data.round,
      n: eligible.length,
      a: fixed(fit.a, 5),
      b: fixed(fit.b, 2),
      "a/0.75 (k)": fixed(fit.a / 0.75, 5),
      "baseMN=3b/a": fixed((3 * fit.b) / fit.a, 1),
      "effMN=4b": fixed(4 * fit.b, 1),
      meanResid: money(fit.meanResidual),
      meanAbsResid: money(fit.meanAbsResidual),
      rmse: money(fit.rmse),
      maxAbsResid: money(fit.maxAbsResidual),
    };
  });

  console.table(regressionRows);

  // ---- Part 3: variants ---------------------------------------------------
  section("Part 3: scaled model variants (one baseMN per period)");

  const roundOne = players.reduce(
    (total, player) => total + (historyRow(player, 1)?.price ?? 0),
    0,
  );

  const period1 = buildPeriod(
    `R2-${DRAFT_ROUND - 1}`,
    allRounds.filter((data) => data.round < DRAFT_ROUND),
    roundOne,
  );

  const roundTen = allRounds.find(
    (data) => data.round === DRAFT_ROUND - 1,
  ) as RoundData;

  const period2 = buildPeriod(
    `R${DRAFT_ROUND}-${lastScoredRound}`,
    allRounds.filter((data) => data.round >= DRAFT_ROUND),
    roundTen.actualTotal,
  );

  const periods = [period1, period2];

  interface VariantResult {
    variant: Variant;
    fits: { period: Period; baseMN: number; error: number }[];
    results: ScaledRoundResult[];
    overallError: number;
  }

  const variantResults: VariantResult[] = VARIANTS.map((variant) => {
    const fits = periods.map((period) => ({
      period,
      ...fitBaseMN([period], variant),
    }));

    const results = fits.flatMap((fit) =>
      runPeriod(fit.period, variant, fit.baseMN),
    );

    return {
      variant,
      fits,
      results,
      overallError: pooledError(results),
    };
  });

  variantResults.sort((a, b) => a.overallError - b.overallError);

  console.log(
    "Variant id = [under-3 A/B][pool 1/2/3][anchor X/Y]-[rounding]",
  );
  console.log(
    "Errors are average absolute price error over eligible players " +
      "(same set as the baseline).",
  );

  console.table([
    {
      rank: "-",
      variant: "BASELINE (current model)",
      p1BaseMN: "per round",
      p1Error: money(baselineP1),
      p2BaseMN: "per round",
      p2Error: money(baselineP2),
      overall: money(baselineAll),
      allPlayersErr: "-",
    },
    ...variantResults.map((result, index) => ({
      rank: index + 1,
      variant: result.variant.id,
      p1BaseMN: fixed(result.fits[0].baseMN, 2),
      p1Error: money(result.fits[0].error),
      p2BaseMN: fixed(result.fits[1].baseMN, 2),
      p2Error: money(result.fits[1].error),
      overall: money(result.overallError),
      allPlayersErr: money(
        result.results.reduce((t, r) => t + r.allError, 0) /
          result.results.reduce((t, r) => t + r.allCount, 0),
      ),
    })),
  ]);

  section("Per-round error by variant (ranked)");

  const roundNumbers = allRounds.map((data) => data.round);

  console.table(
    [
      {
        variant: "BASELINE",
        ...Object.fromEntries(
          roundNumbers.map((round) => [
            `R${round}`,
            Math.round(baselineByRound.get(round)?.error ?? 0),
          ]),
        ),
      },
      ...variantResults.map((result) => ({
        variant: result.variant.id,
        ...Object.fromEntries(
          result.results.map((r) => [
            `R${r.round}`,
            Math.round(r.eligibleError / r.eligibleCount),
          ]),
        ),
      })),
    ],
  );

  // ---- Part 4: best variant detail ---------------------------------------
  const best = variantResults[0];
  const bestRounds = new Map(
    allRounds.map((data) => [data.round, data]),
  );

  section(`Part 4: best variant ${best.variant.id}`);

  console.log(
    `under-3: ${best.variant.under3}, pool: ${best.variant.pool}, ` +
      `anchor: ${best.variant.anchor}, rounding: ${best.variant.rounding}`,
  );
  console.log(
    best.fits
      .map((fit) => `${fit.period.label} baseMN ${fixed(fit.baseMN, 2)}`)
      .join(", "),
  );

  const kRows = best.results.map((result) => {
    const fit = result.round < DRAFT_ROUND ? best.fits[0] : best.fits[1];

    return {
      round: result.round,
      k: fixed(result.k, 6),
      effectiveMN: fixed(fit.baseMN * result.k, 1),
      anchorTotal: money(result.anchorTotal),
      predictedTotal: money(result.predictedTotal),
      actualTotal: money(result.actualTotal),
      avgError: money(result.eligibleError / result.eligibleCount),
    };
  });

  console.table(kRows);

  const meanK = (results: ScaledRoundResult[]) =>
    results.reduce((total, r) => total + r.k, 0) / results.length;

  const kBefore = meanK(best.results.filter((r) => r.round < DRAFT_ROUND));
  const kAfter = meanK(best.results.filter((r) => r.round >= DRAFT_ROUND));

  console.log(
    `Mean k before R${DRAFT_ROUND}: ${fixed(kBefore, 6)}, ` +
      `from R${DRAFT_ROUND}: ${fixed(kAfter, 6)} ` +
      `(${kAfter < kBefore ? "steps DOWN" : "does not step down"}).`,
  );

  // With separate per-period baseMNs a step can be absorbed into baseMN,
  // so also refit the best variant with ONE season-wide baseMN.
  const seasonFit = fitBaseMN(periods, best.variant);
  const seasonResults = periods.flatMap((period) =>
    runPeriod(period, best.variant, seasonFit.baseMN),
  );

  section(
    `Best variant with ONE season-wide baseMN ${fixed(seasonFit.baseMN, 2)}`,
  );

  console.table(
    seasonResults.map((result) => ({
      round: result.round,
      k: fixed(result.k, 6),
      effectiveMN: fixed(seasonFit.baseMN * result.k, 1),
      avgError: money(result.eligibleError / result.eligibleCount),
    })),
  );

  const seasonKBefore = meanK(
    seasonResults.filter((r) => r.round < DRAFT_ROUND),
  );
  const seasonKAfter = meanK(
    seasonResults.filter((r) => r.round >= DRAFT_ROUND),
  );

  console.log(
    `Season-wide fit error ${money(seasonFit.error)}. Mean k before ` +
      `R${DRAFT_ROUND}: ${fixed(seasonKBefore, 6)}, from R${DRAFT_ROUND}: ` +
      `${fixed(seasonKAfter, 6)} ` +
      `(${seasonKAfter < seasonKBefore ? "steps DOWN" : "does not step down"}).`,
  );

  // ---- Error by group ----------------------------------------------------
  section("Best variant: error by group (eligible players)");

  interface Sample {
    row: RoundRow;
    round: number;
    predicted: number;
    error: number;
  }

  const samples: Sample[] = [];

  for (const result of best.results) {
    const data = bestRounds.get(result.round) as RoundData;

    data.rows.forEach((row, index) => {
      if (row.category !== "eligible") {
        return;
      }

      const predicted = result.predictions[index];

      samples.push({
        row,
        round: result.round,
        predicted,
        error: predicted - row.actualPrice,
      });
    });
  }

  const groups: [string, (sample: Sample) => boolean][] = [
    ["all eligible", () => true],
    ["3rd game (first price change)", (s) => s.row.gamesToDate === 3],
    ["4+ games", (s) => s.row.gamesToDate > 3],
    ["team had bye last round", (s) => s.row.teamHadByeLastRound],
    ["missed last round (not a bye)", (s) => s.row.missedLastRoundNotBye],
    ["debutant (0 games before 2026)", (s) => s.row.debutant],
    ["price < $300k", (s) => s.row.oldPrice < 300000],
    [
      "price $300-500k",
      (s) => s.row.oldPrice >= 300000 && s.row.oldPrice < 500000,
    ],
    [
      "price $500-700k",
      (s) => s.row.oldPrice >= 500000 && s.row.oldPrice < 700000,
    ],
    ["price > $700k", (s) => s.row.oldPrice >= 700000],
  ];

  const baselineMN = new Map<number, number>();

  for (const row of baselineRows) {
    baselineMN.set(Number(row.round), Number(row.solvedMN));
  }

  const baselineSampleError = (sample: Sample) => {
    const solved = baselineMN.get(sample.round) as number;
    return Math.abs(
      currentModelPrice(sample.row, solved) - sample.row.actualPrice,
    );
  };

  const groupRows = groups.map(([label, test]) => {
    const members = samples.filter(test);
    const n = members.length || 1;

    return {
      group: label,
      n: members.length,
      avgAbsError: money(
        members.reduce((t, s) => t + Math.abs(s.error), 0) / n,
      ),
      meanSignedError: money(members.reduce((t, s) => t + s.error, 0) / n),
      exactMatchPct: fixed(
        (100 * members.filter((s) => s.error === 0).length) / n,
        1,
      ),
      baselineAvgAbsError: money(
        members.reduce((t, s) => t + baselineSampleError(s), 0) / n,
      ),
    };
  });

  console.table(groupRows);

  // ---- Largest individual errors ----------------------------------------
  section("Best variant: largest individual errors");

  const largest = [...samples]
    .sort((a, b) => Math.abs(b.error) - Math.abs(a.error))
    .slice(0, 25)
    .map((sample) => ({
      player: sample.row.player.name,
      team: sample.row.player.team,
      round: sample.round,
      oldPrice: money(sample.row.oldPrice),
      actual: money(sample.row.actualPrice),
      predicted: money(sample.predicted),
      error: money(sample.error),
      avg3: fixed(sample.row.threeRoundAverage, 1),
      scores: scoreHistory(sample.row.player, sample.round),
    }));

  console.table(largest);

  // ---- CSV output --------------------------------------------------------
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });

  const variantCsv: Record<string, string | number>[] = [];

  for (const [round, value] of baselineByRound) {
    variantCsv.push({
      rank: 0,
      variant: "BASELINE",
      under3: "",
      pool: "",
      anchor: "",
      rounding: "ceil100",
      period: round < DRAFT_ROUND ? period1.label : period2.label,
      round,
      baseMN: baselineMN.get(round) ?? "",
      k: 1,
      effectiveMN: baselineMN.get(round) ?? "",
      players: value.n,
      avgAbsError: fixed(value.error, 2),
      periodError: fixed(
        round < DRAFT_ROUND ? baselineP1 : baselineP2,
        2,
      ),
      overallError: fixed(baselineAll, 2),
      anchorTotal: "",
      predictedTotal: "",
      actualTotal: bestRounds.get(round)?.actualTotal ?? "",
    });
  }

  variantResults.forEach((result, index) => {
    for (const r of result.results) {
      const fit = r.round < DRAFT_ROUND ? result.fits[0] : result.fits[1];

      variantCsv.push({
        rank: index + 1,
        variant: result.variant.id,
        under3: result.variant.under3,
        pool: result.variant.pool,
        anchor: result.variant.anchor,
        rounding: result.variant.rounding,
        period: fit.period.label,
        round: r.round,
        baseMN: fixed(fit.baseMN, 2),
        k: fixed(r.k, 8),
        effectiveMN: fixed(fit.baseMN * r.k, 2),
        players: r.eligibleCount,
        avgAbsError: fixed(r.eligibleError / r.eligibleCount, 2),
        periodError: fixed(fit.error, 2),
        overallError: fixed(result.overallError, 2),
        anchorTotal: Math.round(r.anchorTotal),
        predictedTotal: r.predictedTotal,
        actualTotal: r.actualTotal,
      });
    }
  });

  const playerCsv = samples.map((sample) => ({
    variant: best.variant.id,
    round: sample.round,
    playerId: sample.row.player.id,
    player: sample.row.player.name,
    team: sample.row.player.team,
    oldPrice: sample.row.oldPrice,
    actualPrice: sample.row.actualPrice,
    predictedPrice: sample.predicted,
    error: sample.error,
    baselineError:
      currentModelPrice(
        sample.row,
        baselineMN.get(sample.round) as number,
      ) - sample.row.actualPrice,
    threeRoundAverage: fixed(sample.row.threeRoundAverage, 3),
    gamesToDate: sample.row.gamesToDate,
    teamHadByeLastRound: sample.row.teamHadByeLastRound ? 1 : 0,
    missedLastRoundNotBye: sample.row.missedLastRoundNotBye ? 1 : 0,
    debutant: sample.row.debutant ? 1 : 0,
    scores: scoreHistory(sample.row.player, sample.round),
  }));

  const variantFile = path.join(
    OUTPUT_DIRECTORY,
    "backtest-pricing-variants.csv",
  );
  const playerFile = path.join(
    OUTPUT_DIRECTORY,
    "backtest-pricing-best-player-errors.csv",
  );

  await writeFile(variantFile, toCsv(variantCsv), "utf8");
  await writeFile(playerFile, toCsv(playerCsv), "utf8");

  section("Output");
  console.log(path.relative(ROOT, variantFile));
  console.log(path.relative(ROOT, playerFile));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
