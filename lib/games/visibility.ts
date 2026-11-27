/**
 * Which rounds the results archive shows. For the current season, only
 * rounds up to the last completed round (which is the locked round under
 * DEBUG_AS_OF_ROUND), so later rounds are invisible everywhere. Earlier
 * seasons show every round they have; later seasons show nothing.
 */
export function isRoundVisible(
  season: number,
  round: number,
  { currentSeason, lastVisibleRound }: { currentSeason: number; lastVisibleRound: number },
): boolean {
  if (season > currentSeason) return false;
  if (season < currentSeason) return true;
  return round <= lastVisibleRound;
}

/** Rounds from an index that are visible, ascending. */
export function visibleRounds(
  season: number,
  rounds: readonly number[],
  settings: { currentSeason: number; lastVisibleRound: number },
): number[] {
  return [...rounds].filter((r) => isRoundVisible(season, r, settings)).sort((a, b) => a - b);
}
