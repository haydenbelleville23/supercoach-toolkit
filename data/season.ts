export const SEASON_YEAR = 2026;
export const FIRST_ROUND = 0;
export const FINAL_ROUND = 24;
export const CURRENT_COMPLETED_ROUND = 18;

export function getSeasonRounds(): number[] {
  return Array.from(
    { length: FINAL_ROUND - FIRST_ROUND + 1 },
    (_, index) => FIRST_ROUND + index,
  );
}