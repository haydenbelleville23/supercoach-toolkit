import type { MagicNumberRound } from "@/lib/priceEngine/calculateRoundMagicNumber";

const TOTAL_ROUNDS = 24;

export const magicNumberHistory: MagicNumberRound[] =
  Array.from({ length: TOTAL_ROUNDS }, (_, index) => {
    const round = index + 1;

    return {
      round,

      // Starting SuperCoach magic number.
      // Replace each round with the observed value as we confirm it.
      magicNumber: round === 1 ? 5412 : null,

      // Calculated from the complete official player-price dataset.
      totalPlayerPricePool: null,

      // Our estimate using only information available before
      // that round's prices were released.
      estimatedMagicNumber: null,

      // Retrospectively solved using official post-round prices.
      calculatedMagicNumber: null,
    };
  });