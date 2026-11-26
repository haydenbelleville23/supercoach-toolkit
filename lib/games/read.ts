import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { CURRENT_COMPLETED_ROUND, SEASON_YEAR } from "@/data/season";

import { parseGameId, roundFileName } from "./buildGames";
import type { Game, GamesIndex, RoundGamesFile } from "./types";
import { validateGamesIndex, validateRoundFile } from "./validate";
import { visibleRounds as filterVisible } from "./visibility";

/**
 * Server-only reads of the results archive (Node fs; never import from a
 * client component). Each request reads just the
 * round it needs from data/{season}/games/ (never the big raw files).
 * next.config.ts traces these files into the deployment.
 */
const DATA_DIR = path.join(process.cwd(), "data");

const SETTINGS = { currentSeason: SEASON_YEAR, lastVisibleRound: CURRENT_COMPLETED_ROUND };

function gamesDir(season: number): string {
  return path.join(DATA_DIR, String(season), "games");
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** A season's index, or null if it has no games. */
export function readGamesIndex(season: number): GamesIndex | null {
  const file = path.join(gamesDir(season), "index.json");
  if (!existsSync(file)) return null;

  const check = validateGamesIndex(readJson(file));
  if (!check.ok) throw new Error(`${file} is invalid:\n- ${check.errors.join("\n- ")}`);
  return check.value;
}

/** Seasons with game files that have at least one visible round, newest first. */
export function seasonsWithGames(): number[] {
  if (!existsSync(DATA_DIR)) return [];

  return readdirSync(DATA_DIR)
    .filter((name) => /^\d{4}$/.test(name))
    .map(Number)
    .filter((season) => visibleRoundsFor(season).length > 0)
    .sort((a, b) => b - a);
}

/** The rounds a season shows (lock applied), ascending. */
export function visibleRoundsFor(season: number): number[] {
  const index = readGamesIndex(season);
  return index ? filterVisible(season, index.rounds, SETTINGS) : [];
}

/** One visible round's games, or null (hidden, missing or not a round). */
export function readRoundGames(season: number, round: number): RoundGamesFile | null {
  if (!Number.isInteger(round) || !visibleRoundsFor(season).includes(round)) return null;

  const file = path.join(gamesDir(season), roundFileName(round));
  if (!existsSync(file)) return null;

  const check = validateRoundFile(readJson(file), { season, round });
  if (!check.ok) throw new Error(`${file} is invalid:\n- ${check.errors.join("\n- ")}`);
  return check.value;
}

/** A game by id, or null if it's unknown or in a hidden round. */
export function findGame(gameId: string): Game | null {
  const parsed = parseGameId(gameId);
  if (!parsed) return null;
  return readRoundGames(parsed.season, parsed.round)?.games.find((g) => g.id === gameId) ?? null;
}

export { SEASON_YEAR };
