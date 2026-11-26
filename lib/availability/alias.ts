/**
 * Which file the app's availability data comes from. next.config.ts points
 * the AVAILABILITY_SPECIFIER import at it, so a normal build never
 * bundles or reads the invented sample.
 *
 * - DEBUG_AS_OF_ROUND set: the invented sample (availability is a live
 *   snapshot and can't be time-travelled), or no data if it's missing.
 * - Otherwise: data/{season}/availability.json, or no data if there's no
 *   file yet. A missing file means no data, never "everyone available".
 */
export const AVAILABILITY_SEASON = 2026;
export const AVAILABILITY_SPECIFIER = "availability-snapshot";

export const AVAILABILITY_FILE = `data/${AVAILABILITY_SEASON}/availability.json`;
export const AVAILABILITY_FIXTURE_FILE = `data/${AVAILABILITY_SEASON}/availability.fixture.json`;
export const NO_AVAILABILITY_FILE = "lib/availability/no-data.json";

export function availabilitySource({
  asOfRound,
  fileExists,
  fixtureExists,
}: {
  asOfRound: number | null;
  fileExists: boolean;
  fixtureExists: boolean;
}): string {
  if (asOfRound !== null) {
    return fixtureExists ? AVAILABILITY_FIXTURE_FILE : NO_AVAILABILITY_FILE;
  }
  return fileExists ? AVAILABILITY_FILE : NO_AVAILABILITY_FILE;
}
