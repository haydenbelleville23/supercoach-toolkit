import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Player } from "../../types/player";

import { createBreakevenLookup } from "./breakevens";
import {
  buildRoundGames,
  isRoundComplete,
  roundFileName,
  type RawFixtureRound,
  type RawPlayerDetail,
} from "./buildGames";
import type { GamesIndex } from "./types";
import { validateGamesIndex, validateRoundFile } from "./validate";

export interface WriteGamesResult {
  /** Rounds written (new, or rebuilt with refresh). */
  written: number[];
  /** Rounds whose file already existed and was left alone. */
  kept: number[];
  /** Rounds rebuilt with refresh but identical, so not rewritten. */
  unchanged: number[];
  /** Players skipped because they couldn't be linked. */
  problems: string[];
  completedRounds: number[];
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** Writes a file only when its content changes (so re-runs touch nothing). */
function writeIfChanged(file: string, content: string): boolean {
  if (existsSync(file) && readFileSync(file, "utf8") === content) return false;
  writeFileSync(file, content);
  return true;
}

/**
 * Builds data/{season}/games/round-NN.json for every completed round plus
 * index.json, from fixtures-raw.json and player-details/. Existing round
 * files are kept (and checked) unless `refresh`. Throws with a clear
 * message when the inputs are missing or a file fails validation.
 */
export function writeGamesFiles({
  season,
  dataDir,
  outDir = path.join(dataDir, String(season), "games"),
  refresh = false,
}: {
  season: number;
  /** The folder holding {season}/ (normally data/). */
  dataDir: string;
  outDir?: string;
  refresh?: boolean;
}): WriteGamesResult {
  const seasonDir = path.join(dataDir, String(season));
  const fixturesFile = path.join(seasonDir, "fixtures-raw.json");
  const detailsDir = path.join(seasonDir, "player-details");

  if (!existsSync(fixturesFile)) {
    throw new Error(`Missing ${fixturesFile}. Run npm run download:fixtures first.`);
  }
  if (!existsSync(detailsDir)) {
    throw new Error(`Missing ${detailsDir}. Run npm run download:players first.`);
  }

  const fixtures = JSON.parse(readFileSync(fixturesFile, "utf8")) as { rounds?: RawFixtureRound[] };
  if (!Array.isArray(fixtures.rounds)) {
    throw new Error(`${fixturesFile} has no rounds.`);
  }

  const normalisedFile = path.join(seasonDir, "players-normalised.json");
  if (!existsSync(normalisedFile)) {
    throw new Error(`Missing ${normalisedFile}. Run npm run build:players first.`);
  }
  // Breakevens as the site showed them after each round (computed lazily).
  const breakevens = createBreakevenLookup(
    JSON.parse(readFileSync(normalisedFile, "utf8")) as Player[],
    fixtures as unknown as Parameters<typeof createBreakevenLookup>[1],
  );

  const detailFiles = readdirSync(detailsDir).filter((name) => /^\d+\.json$/.test(name));
  if (detailFiles.length === 0) {
    throw new Error(`${detailsDir} has no player files.`);
  }
  const players = detailFiles.map(
    (name) => JSON.parse(readFileSync(path.join(detailsDir, name), "utf8")) as RawPlayerDetail,
  );

  mkdirSync(outDir, { recursive: true });

  const result: WriteGamesResult = { written: [], kept: [], unchanged: [], problems: [], completedRounds: [] };
  const gameCounts: Record<string, number> = {};

  for (const round of [...fixtures.rounds].sort((a, b) => a.round - b.round)) {
    if (!isRoundComplete(round)) continue;
    result.completedRounds.push(round.round);

    const file = path.join(outDir, roundFileName(round.round));

    if (existsSync(file) && !refresh) {
      const check = validateRoundFile(JSON.parse(readFileSync(file, "utf8")), { season, round: round.round });
      if (!check.ok) {
        throw new Error(`${file} is invalid (run with --refresh to rebuild it):\n- ${check.errors.join("\n- ")}`);
      }
      gameCounts[round.round] = check.value.games.length;
      result.kept.push(round.round);
      continue;
    }

    const built = buildRoundGames({ season, round, players, breakevens });
    result.problems.push(...built.problems);

    const linked = built.file.games.reduce((n, g) => n + g.players.home.length + g.players.away.length, 0);
    if (linked === 0) {
      throw new Error(`Round ${round.round} is complete but no player stats link to it. Is player-details up to date?`);
    }

    const check = validateRoundFile(built.file, { season, round: round.round });
    if (!check.ok) {
      throw new Error(`Round ${round.round} failed validation:\n- ${check.errors.join("\n- ")}`);
    }

    gameCounts[round.round] = built.file.games.length;
    if (writeIfChanged(file, json(built.file))) {
      result.written.push(round.round);
    } else {
      result.unchanged.push(round.round);
    }
  }

  const index: GamesIndex = { season, rounds: result.completedRounds, gameCounts };
  const indexCheck = validateGamesIndex(index);
  if (!indexCheck.ok) {
    throw new Error(`The games index failed validation:\n- ${indexCheck.errors.join("\n- ")}`);
  }
  writeIfChanged(path.join(outDir, "index.json"), json(index));

  return result;
}
