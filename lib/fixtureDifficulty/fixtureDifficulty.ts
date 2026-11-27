import { NEXT_ROUNDS, POSITION_GROUPS, type PositionGroup } from "./config";
import type { PositionDifficulty } from "./positionDifficulty";

export interface FixtureGame {
  round: number;
  homeTeam: string;
  awayTeam: string;
}

export interface FixtureCell {
  round: number;
  /** Opponent code, or null on a bye. */
  opponent: string | null;
  homeAway: "H" | "A" | null;
  bye: boolean;
  /** The opponent's difficulty for this position, or null (bye or no data). */
  value: number | null;
  n: number;
}

export interface FixtureRow {
  team: string;
  /** Mean over the displayed future fixtures (null when none). */
  rest: number | null;
  /** Mean over the next NEXT_ROUNDS played rounds, byes skipped (fewer if fewer remain). */
  next5: number | null;
  cells: FixtureCell[];
}

/** The opponent and home/away for a team in a round, or null on a bye. */
export function opponentFor(
  fixtures: readonly FixtureGame[],
  team: string,
  round: number,
): { opponent: string; homeAway: "H" | "A" } | null {
  const game = fixtures.find((f) => f.round === round && (f.homeTeam === team || f.awayTeam === team));
  if (!game) return null;
  return game.homeTeam === team
    ? { opponent: game.awayTeam, homeAway: "H" }
    : { opponent: game.homeTeam, homeAway: "A" };
}

const mean = (values: number[]) => (values.length === 0 ? null : values.reduce((t, v) => t + v, 0) / values.length);

/**
 * One row per team for a position: a cell per round from `fromRound` to
 * `lastRound` (opponent, home/away, bye, value, n), plus Rest (mean of the
 * future cells shown) and Next5. Future rounds are those after `asOfRound`.
 */
export function buildFixtureRows({
  fixtures,
  difficulty,
  position,
  asOfRound,
  fromRound,
  lastRound,
  teams,
}: {
  fixtures: readonly FixtureGame[];
  difficulty: PositionDifficulty;
  position: PositionGroup;
  asOfRound: number;
  fromRound: number;
  lastRound: number;
  teams: readonly string[];
}): FixtureRow[] {
  return teams.map((team) => {
    const cells: FixtureCell[] = [];
    for (let round = fromRound; round <= lastRound; round++) {
      const game = opponentFor(fixtures, team, round);
      const cell = game ? difficulty.get(game.opponent)?.[position] : undefined;
      cells.push({
        round,
        opponent: game?.opponent ?? null,
        homeAway: game?.homeAway ?? null,
        bye: !game,
        value: cell?.value ?? null,
        n: cell?.n ?? 0,
      });
    }

    const future = cells.filter((c) => c.round > asOfRound && !c.bye && c.value !== null);
    return {
      team,
      rest: mean(future.map((c) => c.value as number)),
      next5: mean(future.slice(0, NEXT_ROUNDS).map((c) => c.value as number)),
      cells,
    };
  });
}

export { POSITION_GROUPS };
