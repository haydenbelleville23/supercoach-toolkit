import type { Player } from "@/types/player";

export type LivePlayerProjection = {
  player: Player;

  liveScore: number;

  currentPrice: number;
  currentBreakEven: number;

  projectedPrice: number;
  projectedPriceChange: number;

  nextBreakEven: number | null;
};

export type LiveScoreOverrides = Record<
  number,
  number
>;