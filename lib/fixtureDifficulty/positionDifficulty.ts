import type { Player } from "../../types/player";

import {
  MATCHUP_SHRINK_K,
  MIN_GAMES,
  MIN_SEASON_AVG,
  POSITION_GROUPS,
  type PositionGroup,
} from "./config";

export interface DifficultyCell {
  /** Mean residual (after shrinkage, if any): + means opponents score above average (easy). */
  value: number;
  /** Player-games behind it. */
  n: number;
}

/** Opponent team -> position group -> cell (missing when no player-games). */
export type PositionDifficulty = Map<string, Partial<Record<PositionGroup, DifficultyCell>>>;

export interface PositionDifficultyOptions {
  minSeasonAvg?: number;
  minGames?: number;
  shrinkK?: number;
}

const isGroup = (p: string): p is PositionGroup => (POSITION_GROUPS as readonly string[]).includes(p);

/**
 * How much more (or less) good players score against each team, by
 * position group, using only rounds up to `asOfRound`.
 *
 * - A player counts if his season average (his games up to asOfRound) is
 *   above minSeasonAvg with at least minGames games.
 * - Each of his games gives a residual: that game's score minus his season
 *   average (which includes that game).
 * - His SuperCoach positions decide the groups; a dual-position player
 *   counts in both.
 * - A cell is the mean residual for that opponent and group, with n; if
 *   shrinkK > 0 it's multiplied by n / (n + k).
 */
export function computePositionDifficulty(
  players: readonly Player[],
  asOfRound: number,
  {
    minSeasonAvg = MIN_SEASON_AVG,
    minGames = MIN_GAMES,
    shrinkK = MATCHUP_SHRINK_K,
  }: PositionDifficultyOptions = {},
): PositionDifficulty {
  const sums = new Map<string, Partial<Record<PositionGroup, { total: number; n: number }>>>();

  for (const player of players) {
    const games = player.history.filter(
      (h) => h.round <= asOfRound && h.games > 0 && typeof h.score === "number",
    );
    if (games.length < minGames) continue;

    const average = games.reduce((t, h) => t + (h.score as number), 0) / games.length;
    if (!(average > minSeasonAvg)) continue;

    const groups = [...new Set(player.positions.filter(isGroup))];
    if (groups.length === 0) continue;

    for (const game of games) {
      if (!game.opponent) continue;
      const residual = (game.score as number) - average;
      const byGroup = sums.get(game.opponent) ?? {};

      for (const group of groups) {
        const cell = byGroup[group] ?? { total: 0, n: 0 };
        cell.total += residual;
        cell.n += 1;
        byGroup[group] = cell;
      }
      sums.set(game.opponent, byGroup);
    }
  }

  const result: PositionDifficulty = new Map();
  for (const [team, byGroup] of sums) {
    const cells: Partial<Record<PositionGroup, DifficultyCell>> = {};
    for (const group of POSITION_GROUPS) {
      const sum = byGroup[group];
      if (!sum || sum.n === 0) continue;
      const mean = sum.total / sum.n;
      cells[group] = { value: shrinkK > 0 ? mean * (sum.n / (sum.n + shrinkK)) : mean, n: sum.n };
    }
    result.set(team, cells);
  }
  return result;
}
