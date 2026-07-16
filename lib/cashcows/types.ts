import type { Player } from "@/types/player";

export type CashCowProjectedRound = {
  round: number;
  score: number;
  price: number;
  priceChange: number | null;
};

export type CashCowRow = {
  player: Player;

  projectedAverage: number;

  toppedOutPrice: number;
  toppedOutGain: number;
  toppedOutRound: number | null;

  rise1: number | null;
  rise3: number | null;
  rise5: number | null;

  projectedRounds: CashCowProjectedRound[];
};

export type CashCowScoreOverrides = Record<
  number,
  Record<number, number>
>;