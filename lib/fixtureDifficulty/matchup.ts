import type { Player } from "../../types/player";

import { POSITION_GROUPS, type PositionGroup } from "./config";
import { opponentFor, type FixtureGame } from "./fixtureDifficulty";
import type { PositionDifficulty } from "./positionDifficulty";

export interface MatchupAdjustment {
  opponent: string;
  homeAway: "H" | "A";
  /** Points added to the projection (0 when the opponent has no data). */
  value: number;
}

/**
 * The opponent's position difficulty for a player in a round: the mean of
 * his positions' cells (a dual-position player gets the average of both).
 * Null on a bye. When no cell exists for any of his positions, 0.
 */
export function matchupAdjustment(
  player: Pick<Player, "team" | "positions">,
  round: number,
  fixtures: readonly FixtureGame[],
  difficulty: PositionDifficulty,
): MatchupAdjustment | null {
  const game = opponentFor(fixtures, player.team, round);
  if (!game) return null;

  const cells = difficulty.get(game.opponent) ?? {};
  const values = player.positions
    .filter((p): p is PositionGroup => (POSITION_GROUPS as readonly string[]).includes(p))
    .map((p) => cells[p]?.value)
    .filter((v): v is number => typeof v === "number");

  return {
    ...game,
    value: values.length === 0 ? 0 : values.reduce((t, v) => t + v, 0) / values.length,
  };
}
