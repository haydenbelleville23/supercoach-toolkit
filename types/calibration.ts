export type CalibrationResult = {
  playerId: number;

  playerName: string;

  currentPrice: number;

  projectedScore: number;

  officialProjectedPrice: number;

  engineProjectedPrice: number;

  difference: number;
};