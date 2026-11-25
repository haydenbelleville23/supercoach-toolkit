import type { Player } from "@/types/player";
import { calculatePrice } from "./calculatePrice";
import { getLastThreeScores } from "./getLastThreeScores";

export interface MagicNumberEvaluation {
  magicNumber: number;
  playersCompared: number;
  averagePriceError: number;
  maxPriceError: number;
  totalPriceError: number;
  bestPlayerError: number;
}

export function evaluateMagicNumber(
  players: Player[],
  round: number,
  magicNumber: number,
): MagicNumberEvaluation {
  let playersCompared = 0;
  let totalPriceError = 0;
  let maxPriceError = 0;
  let bestPlayerError = Number.MAX_SAFE_INTEGER;
  let missingRounds = 0;
  let missingPrices = 0;
  let insufficientGames = 0;
  let missingScores = 0;

 for (const player of players) {

  if (
    round === 3 &&
    magicNumber === 5200 &&
    player.name === "Nick Daicos"
  ) {
    console.log(player.history);
  }
  const previousRound = player.history.find(
    (h) => h.round === round - 1,
  );

  const currentRound = player.history.find(
    (h) => h.round === round,
  );

  if (!previousRound || !currentRound) {
  missingRounds++;
  continue;
    }

  if (
  previousRound.price === null ||
  currentRound.price === null
) {
  missingPrices++;
  continue;
}

if (currentRound.score === null) {
  continue;
}

const scores = getLastThreeScores(
  player.history,
  round,
);

if (scores === null) {
  missingScores++;
  continue;
}

const [score1, score2, score3] = scores;

  const result = calculatePrice({
    currentPrice: previousRound.price,
    previousScores: [score1, score2],
    projectedScore: score3,
    magicNumber,
  });

  const error = Math.abs(
    result.projectedPrice - currentRound.price,
  );
    bestPlayerError = Math.min(
    bestPlayerError,
    error,
    );
  totalPriceError += error;
  maxPriceError = Math.max(maxPriceError, error);
  playersCompared++;
}

  return {
    magicNumber,
    playersCompared,
    bestPlayerError,
    averagePriceError:
      playersCompared === 0
        ? 0
        : totalPriceError / playersCompared,
    maxPriceError,
    totalPriceError,
  };
}