import { parseAsOfRound } from "./parseAsOfRound";

/**
 * The DEBUG_AS_OF_ROUND lock: the one place the app reads it. Null (unset)
 * is normal behaviour. next.config.ts inlines the variable into server and
 * browser code, so both sides see the same value. Re-exported by
 * data/season.ts; this tiny module lets layouts read it without loading
 * the player data.
 */
export const DEBUG_AS_OF_ROUND: number | null = parseAsOfRound(
  process.env.DEBUG_AS_OF_ROUND,
);
