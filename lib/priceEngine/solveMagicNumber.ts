import type { Player } from "@/types/player";
import {
  evaluateMagicNumber,
  type MagicNumberEvaluation,
} from "./evaluateMagicNumber";

const MIN_MAGIC_NUMBER = 4500;
const MAX_MAGIC_NUMBER = 5600;

function isBetterResult(
  candidate: MagicNumberEvaluation,
  currentBest: MagicNumberEvaluation | null,
): boolean {
  return (
    currentBest === null ||
    candidate.totalPriceError <
      currentBest.totalPriceError
  );
}

function searchRange(
  players: Player[],
  round: number,
  start: number,
  end: number,
  step: number,
): MagicNumberEvaluation | null {
  let bestResult: MagicNumberEvaluation | null = null;

  const precision =
    step < 1
      ? Math.round(1 / step)
      : 1;

  const scaledStart = Math.round(start * precision);
  const scaledEnd = Math.round(end * precision);
  const scaledStep = Math.round(step * precision);

  for (
    let scaledMagicNumber = scaledStart;
    scaledMagicNumber <= scaledEnd;
    scaledMagicNumber += scaledStep
  ) {
    const magicNumber =
      scaledMagicNumber / precision;

    const result = evaluateMagicNumber(
      players,
      round,
      magicNumber,
    );

    if (isBetterResult(result, bestResult)) {
      bestResult = result;
    }
  }

  return bestResult;
}

export function solveMagicNumber(
  players: Player[],
  round: number,
): MagicNumberEvaluation | null {
  const coarseBest = searchRange(
    players,
    round,
    MIN_MAGIC_NUMBER,
    MAX_MAGIC_NUMBER,
    10,
  );

  if (
    coarseBest === null ||
    coarseBest.playersCompared === 0
  ) {
    return null;
  }

  const integerBest = searchRange(
    players,
    round,
    Math.max(
      MIN_MAGIC_NUMBER,
      coarseBest.magicNumber - 10,
    ),
    Math.min(
      MAX_MAGIC_NUMBER,
      coarseBest.magicNumber + 10,
    ),
    1,
  );

  if (integerBest === null) {
    return coarseBest;
  }

  const decimalBest = searchRange(
    players,
    round,
    Math.max(
      MIN_MAGIC_NUMBER,
      integerBest.magicNumber - 1,
    ),
    Math.min(
      MAX_MAGIC_NUMBER,
      integerBest.magicNumber + 1,
    ),
    0.01,
  );

  return decimalBest ?? integerBest;
}