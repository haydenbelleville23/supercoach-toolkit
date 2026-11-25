/**
 * In-round replay of the scaled SuperCoach price model.
 *
 * For each round 3-18, games are revealed one at a time in real kickoff
 * order (data/2026/fixtures-raw.json). After each game the scaled model
 * (lib/priceEngine/calculateScaledRoundPrices) is run with real scores for
 * finished games and projected scores for the rest, then compared with the
 * FINAL published prices.
 *
 * Run with:  node scripts/replay-round.ts
 * Output: console tables plus CSV files in scripts/output/.
 *
 * Assumptions (also printed at run time):
 * - Match order: real kickoff times from fixtures-raw.json.
 * - Lineups are known in advance: whether a player plays this round is
 *   taken from the final data (no late outs or substitutions modelled).
 * - Projection: season average of the player's scores BEFORE this round
 *   (last-3 average when fewer than 3 games, which is the same thing).
 *   The existing projector (lib/projector) reads end-of-data snapshot
 *   fields (average, average3, projectedScores), which would leak future
 *   scores into earlier rounds, so it is not used.
 * - Byes: teams without a fixture that round have no game; their players
 *   did not play and stay frozen.
 * - Errors are measured over eligible players (played and 3+ scores), the
 *   same set as the backtest and /magic-number. Under-3, did-not-play and
 *   newly priced players are frozen by the model and excluded.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as nodeModule from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Player } from "@/types/player";
import type { SuperCoachPlayer } from "@/types/supercoach";

const SEASON = 2026;
const ROOT = process.cwd();
const FIRST_ROUND = 3;
const LAST_ROUND = 18;

const PLAYERS_FILE = path.resolve(`data/${SEASON}/players-complete.json`);
const FIXTURES_FILE = path.resolve(`data/${SEASON}/fixtures-raw.json`);
const OUTPUT_DIRECTORY = path.resolve("scripts/output");

// ---------------------------------------------------------------------------
// Module resolution (same hook as scripts/backtest-pricing.ts): lib/ uses
// extensionless imports and the "@/" alias, which Node does not resolve.
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
      target = pathToFileURL(path.join(ROOT, target.slice(2))).href;
    }

    const isLocal = target.startsWith(".") || target.startsWith("file:");

    if (isLocal && !path.extname(target) && context.parentURL) {
      const filePath = fileURLToPath(new URL(target, context.parentURL));

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

const { BASE_MAGIC_NUMBER_2026 } = await import(
  "../lib/priceEngine/baseMagicNumber"
);
const { buildScaledRoundInputs } = await import(
  "../lib/priceEngine/buildScaledRoundInputs"
);
const { calculateScaledRoundPrices, roundPriceToNearest100 } = await import(
  "../lib/priceEngine/calculateScaledRoundPrices"
);
const { getLastThreeScores } = await import(
  "../lib/priceEngine/getLastThreeScores"
);
const { normaliseSuperCoachPlayer } = await import(
  "../lib/supercoach/normalisePlayer"
);

type ScaledRoundInputs = ReturnType<typeof buildScaledRoundInputs>;
type ScaledRoundInputRow = ScaledRoundInputs["players"][number];

const BASE_MN = BASE_MAGIC_NUMBER_2026;

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface Fixture {
  round: number;
  kickoff: string;
  teams: [string, string];
  label: string;
}

async function loadPlayers(): Promise<Player[]> {
  const raw = JSON.parse(
    await readFile(PLAYERS_FILE, "utf8"),
  ) as SuperCoachPlayer[];

  return raw.map((player) => normaliseSuperCoachPlayer(player));
}

async function loadFixtures(): Promise<Map<number, Fixture[]>> {
  const raw = JSON.parse(await readFile(FIXTURES_FILE, "utf8")) as {
    rounds: {
      round: number;
      response: {
        kickoff: string;
        team1: { abbrev: string };
        team2: { abbrev: string };
      }[];
    }[];
  };

  const byRound = new Map<number, Fixture[]>();

  for (const round of raw.rounds) {
    byRound.set(
      round.round,
      round.response
        .map((game) => ({
          round: round.round,
          kickoff: game.kickoff,
          teams: [game.team1.abbrev, game.team2.abbrev] as [string, string],
          label: `${game.team1.abbrev}-${game.team2.abbrev}`,
        }))
        .sort(
          (a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff),
        ),
    );
  }

  return byRound;
}

// ---------------------------------------------------------------------------
// Per-player replay context
// ---------------------------------------------------------------------------

interface ReplayPlayer {
  input: ScaledRoundInputRow;
  player: Player;
  /** Real score this round (null if the player did not play). */
  realScore: number | null;
  /** First two of the three scores used for the price (eligible only). */
  priorTwo: [number, number] | null;
  /** Point-in-time projection from scores before this round. */
  projectedScore: number;
}

function projectScore(player: Player, round: number): number | null {
  const scores = player.history
    .filter((row) => row.round < round && row.score !== null)
    .map((row) => row.score as number);

  if (scores.length === 0) {
    return null;
  }

  // Season average, or last-3 average with fewer than 3 games (identical
  // when there are fewer than 3 scores).
  const window = scores.length >= 3 ? scores : scores.slice(-3);

  return window.reduce((total, score) => total + score, 0) / window.length;
}

function buildReplayPlayers(
  players: Player[],
  inputs: ScaledRoundInputs,
  round: number,
): { rows: ReplayPlayer[]; missingProjection: number } {
  const byId = new Map(players.map((player) => [player.id, player]));
  let missingProjection = 0;

  const rows = inputs.players.map((input) => {
    const player = byId.get(input.playerId) as Player;
    const current = player.history.find((row) => row.round === round);
    const lastThree = getLastThreeScores(player.history, round);
    let projected = projectScore(player, round);

    if (projected === null) {
      if (input.category === "eligible") {
        missingProjection += 1;
      }

      projected = 0;
    }

    return {
      input,
      player,
      realScore: current?.score ?? null,
      priorTwo:
        input.category === "eligible" && lastThree
          ? ([lastThree[0], lastThree[1]] as [number, number])
          : null,
      projectedScore: projected,
    };
  });

  return { rows, missingProjection };
}

/** Model inputs at a step: real score if the game is done, else projected. */
function stepInputs(
  rows: ReplayPlayer[],
  finishedTeams: Set<string>,
  projectionShift = 0,
): ScaledRoundInputRow[] {
  return rows.map((row) => {
    if (row.input.category !== "eligible" || !row.priorTwo) {
      return row.input;
    }

    const finished = finishedTeams.has(row.player.team);
    const thirdScore = finished
      ? (row.realScore as number)
      : row.projectedScore + projectionShift;

    return {
      ...row.input,
      threeRoundAverage:
        (row.priorTwo[0] + row.priorTwo[1] + thirdScore) / 3,
    };
  });
}

function rawPrice(input: ScaledRoundInputRow): number {
  return 0.75 * input.oldPrice + 0.25 * BASE_MN * input.threeRoundAverage;
}

// ---------------------------------------------------------------------------
// Error statistics
// ---------------------------------------------------------------------------

interface ErrorStats {
  n: number;
  avgAbs: number;
  within100: number;
  within500: number;
}

function errorStats(errors: number[]): ErrorStats {
  const n = errors.length;

  if (n === 0) {
    return { n: 0, avgAbs: Number.NaN, within100: Number.NaN, within500: Number.NaN };
  }

  return {
    n,
    avgAbs: errors.reduce((t, e) => t + Math.abs(e), 0) / n,
    within100: errors.filter((e) => Math.abs(e) <= 100).length / n,
    within500: errors.filter((e) => Math.abs(e) <= 500).length / n,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const money = (value: number) =>
  Number.isNaN(value) ? "-" : `$${Math.round(value).toLocaleString("en-AU")}`;
const pct = (value: number) =>
  Number.isNaN(value) ? "-" : `${(100 * value).toFixed(1)}%`;

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

function section(title: string) {
  console.log("");
  console.log(title);
  console.log("-".repeat(title.length));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface StepResult {
  round: number;
  step: number;
  gamesDone: number;
  gamesTotal: number;
  lastGame: string;
  predictedK: number;
  finalK: number;
  effectiveMN: number;
  all: ErrorStats;
  finished: ErrorStats;
  toPlay: ErrorStats;
  naive: ErrorStats;
}

async function main() {
  console.log(`SuperCoach ${SEASON} in-round price replay`);
  console.log("------------------------------------");
  console.log(`baseMN ${BASE_MN}, anchor = previous round's actual total`);

  const players = await loadPlayers();
  const fixtures = await loadFixtures();

  section("Assumptions");
  console.log(
    [
      "- Match order: real kickoff times (fixtures-raw.json); every round 3-18 has distinct kickoffs, so no random-order fallback is needed.",
      "- Lineups known in advance: who plays this round comes from final data.",
      "- Projection for unplayed games: season average of scores before this round (last-3 average if fewer than 3 games). The lib/projector modes read end-of-data snapshot fields and would leak future scores.",
      "- Byes: teams with no fixture have no game; their players are frozen.",
      "- Errors are over eligible players (played and 3+ scores). Under-3, did-not-play and newly priced players are frozen and excluded.",
      "- Final k = model k with all real scores (not observable directly).",
    ].join("\n"),
  );

  const stepResults: StepResult[] = [];
  const playerCsv: Record<string, string | number>[] = [];
  const sensitivityRows: Record<string, string | number>[] = [];
  const dataChecks: Record<string, string | number>[] = [];

  for (let round = FIRST_ROUND; round <= LAST_ROUND; round++) {
    const games = fixtures.get(round) ?? [];
    const inputs = buildScaledRoundInputs(players, round);
    const { rows, missingProjection } = buildReplayPlayers(
      players,
      inputs,
      round,
    );

    const fixtureTeams = new Set(games.flatMap((game) => game.teams));
    const playedTeams = new Set(
      rows.filter((r) => r.realScore !== null).map((r) => r.player.team),
    );
    const unmatched = [...playedTeams].filter((t) => !fixtureTeams.has(t));

    const eligible = rows.filter((r) => r.input.category === "eligible");

    // Final model run (all games done) and the previous round's final k.
    const allTeams = new Set(fixtureTeams);
    const finalResult = calculateScaledRoundPrices({
      players: stepInputs(rows, allTeams),
      baseMagicNumber: BASE_MN,
      anchorTotal: inputs.anchorTotal,
    });

    const previousInputs = buildScaledRoundInputs(players, round - 1);
    const previousK = calculateScaledRoundPrices({
      players: previousInputs.players,
      baseMagicNumber: BASE_MN,
      anchorTotal: previousInputs.anchorTotal,
    }).k;

    dataChecks.push({
      round,
      games: games.length,
      byeTeams: 18 - fixtureTeams.size,
      eligible: eligible.length,
      under3: rows.filter((r) => r.input.category === "under3").length,
      didNotPlay: rows.filter((r) => r.input.category === "didNotPlay").length,
      eligibleWithoutProjection: missingProjection,
      playedTeamsNotInFixtures: unmatched.join(" ") || "none",
      previousK: previousK.toFixed(6),
      finalK: finalResult.k.toFixed(6),
    });

    const finishedTeams = new Set<string>();

    for (let step = 0; step <= games.length; step++) {
      if (step > 0) {
        for (const team of games[step - 1].teams) {
          finishedTeams.add(team);
        }
      }

      const modelInputs = stepInputs(rows, finishedTeams);
      const result = calculateScaledRoundPrices({
        players: modelInputs,
        baseMagicNumber: BASE_MN,
        anchorTotal: inputs.anchorTotal,
      });

      const allErrors: number[] = [];
      const finishedErrors: number[] = [];
      const toPlayErrors: number[] = [];
      const naiveErrors: number[] = [];

      result.players.forEach((prediction, index) => {
        const row = rows[index];

        if (row.input.category !== "eligible") {
          return;
        }

        const actual = row.input.actualPrice as number;
        const error = prediction.predictedPrice - actual;
        const naivePrice = roundPriceToNearest100(
          previousK * rawPrice(modelInputs[index]),
        );
        const isFinished = finishedTeams.has(row.player.team);

        allErrors.push(error);
        naiveErrors.push(naivePrice - actual);
        (isFinished ? finishedErrors : toPlayErrors).push(error);

        playerCsv.push({
          round,
          step,
          gamesDone: step,
          playerId: row.player.id,
          player: row.player.name,
          team: row.player.team,
          gameFinished: isFinished ? 1 : 0,
          realScore: row.realScore ?? "",
          projectedScore: row.projectedScore.toFixed(2),
          oldPrice: row.input.oldPrice,
          predictedPrice: prediction.predictedPrice,
          naivePrice,
          finalPrice: actual,
          error,
        });
      });

      stepResults.push({
        round,
        step,
        gamesDone: step,
        gamesTotal: games.length,
        lastGame: step === 0 ? "(none)" : games[step - 1].label,
        predictedK: result.k,
        finalK: finalResult.k,
        effectiveMN: result.effectiveMagicNumber,
        all: errorStats(allErrors),
        finished: errorStats(finishedErrors),
        toPlay: errorStats(toPlayErrors),
        naive: errorStats(naiveErrors),
      });

      // Sensitivity: +1 point on every unplayed eligible player's projection.
      // Measured at the start of the round and after half the games.
      if (step === 0 || step === Math.floor(games.length / 2)) {
        const shifted = calculateScaledRoundPrices({
          players: stepInputs(rows, finishedTeams, 1),
          baseMagicNumber: BASE_MN,
          anchorTotal: inputs.anchorTotal,
        });
        const shiftedInputs = stepInputs(rows, finishedTeams, 1);

        const deltas = {
          unplayed: [] as number[],
          unplayed500k: [] as number[],
          finished: [] as number[],
          unplayedRounded: [] as number[],
        };

        rows.forEach((row, index) => {
          if (row.input.category !== "eligible") {
            return;
          }

          // Unrounded so $100 rounding does not hide the effect.
          const before = result.k * rawPrice(modelInputs[index]);
          const after = shifted.k * rawPrice(shiftedInputs[index]);
          const delta = after - before;

          if (finishedTeams.has(row.player.team)) {
            deltas.finished.push(delta);
          } else {
            deltas.unplayed.push(delta);
            deltas.unplayedRounded.push(
              shifted.players[index].predictedPrice -
                result.players[index].predictedPrice,
            );

            if (row.input.oldPrice >= 450000 && row.input.oldPrice < 550000) {
              deltas.unplayed500k.push(delta);
            }
          }
        });

        const mean = (values: number[]) =>
          values.length === 0
            ? Number.NaN
            : values.reduce((t, v) => t + v, 0) / values.length;

        sensitivityRows.push({
          round,
          gamesDone: step,
          unplayedPlayers: deltas.unplayed.length,
          deltaK: shifted.k - result.k,
          deltaEffectiveMN: shifted.effectiveMagicNumber - result.effectiveMagicNumber,
          directEffectPerPlayer: (0.25 * BASE_MN * result.k) / 3,
          meanDeltaUnplayed: mean(deltas.unplayed),
          meanDeltaUnplayedRounded: mean(deltas.unplayedRounded),
          meanDeltaUnplayed450to550k: mean(deltas.unplayed500k),
          n450to550k: deltas.unplayed500k.length,
          meanDeltaFinished: mean(deltas.finished),
          meanAbsDeltaUnplayed: mean(deltas.unplayed.map(Math.abs)),
        });
      }
    }
  }

  // ---- Data checks -------------------------------------------------------
  section("Data checks per round");
  console.table(dataChecks);

  // ---- Step tables -------------------------------------------------------
  section("Per-step accuracy (eligible players vs FINAL published prices)");

  for (let round = FIRST_ROUND; round <= LAST_ROUND; round++) {
    console.log(`\nRound ${round}`);
    console.table(
      stepResults
        .filter((s) => s.round === round)
        .map((s) => ({
          games: `${s.gamesDone}/${s.gamesTotal}`,
          lastGame: s.lastGame,
          kPred: s.predictedK.toFixed(5),
          "k-final": (s.predictedK - s.finalK).toFixed(5),
          effMN: s.effectiveMN.toFixed(1),
          avgErr: money(s.all.avgAbs),
          "≤$100": pct(s.all.within100),
          "≤$500": pct(s.all.within500),
          errDone: money(s.finished.avgAbs),
          nDone: s.finished.n,
          errToPlay: money(s.toPlay.avgAbs),
          nToPlay: s.toPlay.n,
          naiveErr: money(s.naive.avgAbs),
        })),
    );
  }

  // ---- By share of games played -----------------------------------------
  section("Average across rounds by share of games played");

  const buckets = [0, 0.25, 0.5, 0.75, 1];
  console.table(
    buckets.map((share) => {
      const matches = stepResults.filter(
        (s) => s.gamesDone === Math.round(share * s.gamesTotal),
      );
      const avg = (f: (s: StepResult) => number) =>
        matches.reduce((t, s) => t + f(s), 0) / matches.length;

      return {
        share: `${share * 100}%`,
        rounds: matches.length,
        avgErr: money(avg((s) => s.all.avgAbs)),
        "≤$100": pct(avg((s) => s.all.within100)),
        "≤$500": pct(avg((s) => s.all.within500)),
        meanAbsKGap: avg((s) => Math.abs(s.predictedK - s.finalK)).toFixed(5),
        naiveErr: money(avg((s) => s.naive.avgAbs)),
      };
    }),
  );

  // ---- Thresholds --------------------------------------------------------
  section("Games played before error drops under $200 / $100");

  const thresholdRows = [];

  for (let round = FIRST_ROUND; round <= LAST_ROUND; round++) {
    const steps = stepResults.filter((s) => s.round === round);
    const firstUnder = (limit: number) =>
      steps.find((s) => s.all.avgAbs < limit)?.gamesDone ?? "never";
    const staysUnder = (limit: number) => {
      for (let i = 0; i < steps.length; i++) {
        if (steps.slice(i).every((s) => s.all.avgAbs < limit)) {
          return steps[i].gamesDone;
        }
      }
      return "never";
    };

    thresholdRows.push({
      round,
      games: steps.length - 1,
      startErr: money(steps[0].all.avgAbs),
      firstUnder200: firstUnder(200),
      staysUnder200: staysUnder(200),
      firstUnder100: firstUnder(100),
      staysUnder100: staysUnder(100),
      gamesLeftWhenUnder100:
        typeof staysUnder(100) === "number"
          ? steps.length - 1 - (staysUnder(100) as number)
          : "-",
      finalErr: money(steps[steps.length - 1].all.avgAbs),
    });
  }

  console.table(thresholdRows);

  // ---- Sensitivity -------------------------------------------------------
  section("Sensitivity: +1 point on every unplayed projection (unrounded $)");

  console.table(
    sensitivityRows.map((row) => ({
      round: row.round,
      gamesDone: row.gamesDone,
      unplayed: row.unplayedPlayers,
      deltaK: Number(row.deltaK).toExponential(3),
      deltaEffMN: Number(row.deltaEffectiveMN).toFixed(2),
      directOnly: money(Number(row.directEffectPerPlayer)),
      meanUnplayed: money(Number(row.meanDeltaUnplayed)),
      unplayed450to550k: money(Number(row.meanDeltaUnplayed450to550k)),
      meanFinished: money(Number(row.meanDeltaFinished)),
    })),
  );

  // ---- CSV ---------------------------------------------------------------
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });

  const stepCsv = stepResults.map((s) => ({
    round: s.round,
    gamesDone: s.gamesDone,
    gamesTotal: s.gamesTotal,
    lastGame: s.lastGame,
    predictedK: s.predictedK.toFixed(8),
    finalK: s.finalK.toFixed(8),
    kGap: (s.predictedK - s.finalK).toFixed(8),
    effectiveMN: s.effectiveMN.toFixed(2),
    players: s.all.n,
    avgAbsError: s.all.avgAbs.toFixed(2),
    within100: s.all.within100.toFixed(4),
    within500: s.all.within500.toFixed(4),
    finishedPlayers: s.finished.n,
    finishedAvgAbsError: Number.isNaN(s.finished.avgAbs) ? "" : s.finished.avgAbs.toFixed(2),
    toPlayPlayers: s.toPlay.n,
    toPlayAvgAbsError: Number.isNaN(s.toPlay.avgAbs) ? "" : s.toPlay.avgAbs.toFixed(2),
    naiveAvgAbsError: s.naive.avgAbs.toFixed(2),
    naiveWithin100: s.naive.within100.toFixed(4),
  }));

  const files: [string, Record<string, string | number>[]][] = [
    ["replay-round-steps.csv", stepCsv],
    ["replay-round-players.csv", playerCsv],
    ["replay-round-sensitivity.csv", sensitivityRows],
    ["replay-round-thresholds.csv", thresholdRows as Record<string, string | number>[]],
  ];

  section("Output");

  for (const [name, rows] of files) {
    const file = path.join(OUTPUT_DIRECTORY, name);
    await writeFile(file, toCsv(rows), "utf8");
    console.log(path.relative(ROOT, file));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
