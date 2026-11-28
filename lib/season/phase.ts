/**
 * Where the season is:
 * - "preseason": no round completed yet (fixtures may or may not be in);
 * - "inseason": at least one round completed, rounds still to play;
 * - "complete": the last fixtured round is completed.
 */
export type SeasonPhase = "preseason" | "inseason" | "complete";

export function deriveSeasonPhase({
  completedRound,
  firstRound,
  lastFixtureRound,
}: {
  /** The latest completed round (firstRound - 1 when none). */
  completedRound: number;
  firstRound: number;
  /** The last round with a fixture, or null when there are no fixtures. */
  lastFixtureRound: number | null;
}): SeasonPhase {
  if (completedRound < firstRound) return "preseason";
  if (lastFixtureRound !== null && completedRound >= lastFixtureRound) return "complete";
  return "inseason";
}
