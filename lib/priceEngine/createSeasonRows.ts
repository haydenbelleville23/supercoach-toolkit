import {
  CURRENT_COMPLETED_ROUND,
  getSeasonRounds,
} from "@/data/season";
import { getMagicNumber } from "@/lib/magicNumbers";
import type { SeasonProjectionRow } from "@/types/projection";

export function createSeasonRows(): SeasonProjectionRow[] {
  return getSeasonRounds().map((round) => ({
    round,
    played: round > CURRENT_COMPLETED_ROUND,
    isActual: round <= CURRENT_COMPLETED_ROUND,
    score: null,
    magicNumber: getMagicNumber(round),
    breakEven: null,
    price: null,
    priceChange: null,
    threeRoundAverage: null,
  }));
}