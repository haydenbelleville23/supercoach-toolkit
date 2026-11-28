/**
 * Which file the Live page's sample feed comes from. next.config.ts points
 * the LIVE_SAMPLE_SPECIFIER import at it, so a normal build never bundles
 * or reads the invented sample.
 *
 * - DEBUG_AS_OF_ROUND set: the invented sample, or no data if it's missing.
 * - Otherwise: always no data. The real feed comes from /api/live-scores.
 */
export const LIVE_SAMPLE_SPECIFIER = "live-sample-feed";

export const LIVE_SAMPLE_FIXTURE_FILE = "data/2026/live-sample.fixture.json";
export const NO_LIVE_SAMPLE_FILE = "lib/liveMatch/no-live-sample.json";

export function liveSampleSource({
  asOfRound,
  fixtureExists,
}: {
  asOfRound: number | null;
  fixtureExists: boolean;
}): string {
  return asOfRound !== null && fixtureExists
    ? LIVE_SAMPLE_FIXTURE_FILE
    : NO_LIVE_SAMPLE_FILE;
}
