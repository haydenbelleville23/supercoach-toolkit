import type { CashCowProjectedRound } from "./types";

/**
 * "@RIC +6.7" (away) or "v RIC -2.0" (home): the opponent and the matchup
 * adjustment included in a projected score. Null when there isn't one.
 */
export function matchupLabel(
  round: Pick<CashCowProjectedRound, "opponent" | "homeAway" | "matchupAdjustment">,
): string | null {
  const value = round.matchupAdjustment;
  if (value === null || value === undefined || !round.opponent) return null;
  const signed = `${value > 0 ? "+" : value < 0 ? "-" : "±"}${Math.abs(value).toFixed(1)}`;
  return `${round.homeAway === "A" ? "@" : "v "}${round.opponent} ${signed}`;
}
