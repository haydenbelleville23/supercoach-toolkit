/**
 * Parses DEBUG_AS_OF_ROUND. Unset or empty means the lock is off (null).
 * Anything else must be a whole round number from 1 to 24, otherwise this
 * throws so a typo cannot silently show live data.
 */
export function parseAsOfRound(value: string | undefined): number | null {
  const trimmed = value?.trim() ?? "";

  if (trimmed === "") {
    return null;
  }

  const round = Number(trimmed);

  if (!Number.isInteger(round) || round < 1 || round > 24) {
    throw new Error(
      `DEBUG_AS_OF_ROUND must be a round from 1 to 24 (got "${value}").`,
    );
  }

  return round;
}
