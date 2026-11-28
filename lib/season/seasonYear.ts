/**
 * The season the site shows. No imports, so scripts can load it.
 *
 * ACTIVE_SEASON is the committed setting: adding a data/2027 folder changes
 * nothing on the live site until this is changed to 2027.
 *
 * DEBUG_SEASON=2027 (an environment variable, like DEBUG_AS_OF_ROUND) shows
 * another season locally: npm run dev:2027. It is never set in any
 * committed file, next.config or Vercel, so production ignores it.
 * next.config.ts inlines it so server and browser code agree.
 */
export const ACTIVE_SEASON = 2026;

/** Unset or empty: null. Otherwise a season year, or this throws (no silent typo). */
export function parseDebugSeason(value: string | undefined): number | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") return null;

  const season = Number(trimmed);
  if (!Number.isInteger(season) || season < 2020 || season > 2100) {
    throw new Error(`DEBUG_SEASON must be a season year such as 2027 (got "${value}").`);
  }
  return season;
}

export const DEBUG_SEASON: number | null = parseDebugSeason(process.env.DEBUG_SEASON);

/** The season shown: DEBUG_SEASON when set locally, else ACTIVE_SEASON. */
export const SEASON_YEAR: number = DEBUG_SEASON ?? ACTIVE_SEASON;
