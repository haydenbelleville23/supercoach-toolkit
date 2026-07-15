export type PlayerState = {
  currentRound: number;
  price: number;
  scores: number[];
};

export type RoundResult = {
  state: PlayerState;

  price: number;
  priceChange: number;

  breakEven: number;
  threeRoundAverage: number;

  magicNumber: number;
};