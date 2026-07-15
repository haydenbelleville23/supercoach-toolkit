import { roundPriceUp } from "./roundPrice";

export type CompetitionPlayerState = {
  price: number;
  gamesPlayed: number;
  recentScores: number[];
  projectedScore: number | null;
  active: boolean;
};

export type RoundMagicNumberResult = {
  magicNumber: number;
  targetSalaryPool: number;
  calculatedSalaryPool: number;
  salaryPoolDifference: number;
  lockedSalary: number;
  changingPlayerPreviousSalary: number;
  changingPlayerAverageTotal: number;
  eligiblePlayers: number;
  lockedPlayers: number;
};

function getPreviousTwoScores(
  player: CompetitionPlayerState,
): [number, number] | null {
  if (player.recentScores.length < 2) {
    return null;
  }

  const previousScores = player.recentScores.slice(-2);

  return [previousScores[0], previousScores[1]];
}

function canChangePrice(
  player: CompetitionPlayerState,
): boolean {
  return (
    player.active &&
    player.gamesPlayed >= 2 &&
    player.projectedScore !== null &&
    player.recentScores.length >= 2
  );
}

function calculateThreeRoundAverage(
  player: CompetitionPlayerState,
): number | null {
  const previousScores = getPreviousTwoScores(player);

  if (
    previousScores === null ||
    player.projectedScore === null
  ) {
    return null;
  }

  return (
    previousScores[0] +
    previousScores[1] +
    player.projectedScore
  ) / 3;
}

function calculateCompetitionSalary(
  players: CompetitionPlayerState[],
  magicNumber: number,
): number {
  return players.reduce((total, player) => {
    if (!canChangePrice(player)) {
      return total + player.price;
    }

    const threeRoundAverage =
      calculateThreeRoundAverage(player);

    if (threeRoundAverage === null) {
      return total + player.price;
    }

    const rawPrice =
      (
        player.price * 3 +
        threeRoundAverage * magicNumber
      ) / 4;

    return total + roundPriceUp(rawPrice);
  }, 0);
}

export function calculateRoundMagicNumber(
  players: CompetitionPlayerState[],
  targetSalaryPool: number,
): RoundMagicNumberResult {
  if (players.length === 0) {
    throw new Error(
      "At least one player is required to calculate the Magic Number.",
    );
  }

  if (targetSalaryPool <= 0) {
    throw new Error(
      "The target salary pool must be greater than zero.",
    );
  }

  const eligiblePlayers = players.filter(canChangePrice);
  const lockedPlayers = players.filter(
    (player) => !canChangePrice(player),
  );

  const lockedSalary = lockedPlayers.reduce(
    (total, player) => total + player.price,
    0,
  );

  const changingPlayerPreviousSalary =
    eligiblePlayers.reduce(
      (total, player) => total + player.price,
      0,
    );

  const changingPlayerAverageTotal =
    eligiblePlayers.reduce((total, player) => {
      const average =
        calculateThreeRoundAverage(player);

      return total + (average ?? 0);
    }, 0);

  if (changingPlayerAverageTotal <= 0) {
    throw new Error(
      "No price-eligible players have sufficient score data.",
    );
  }

  const availableChangingSalary =
    targetSalaryPool - lockedSalary;

  const initialMagicNumber =
    (
      availableChangingSalary * 4 -
      changingPlayerPreviousSalary * 3
    ) / changingPlayerAverageTotal;

  /*
   * Displayed SuperCoach prices are rounded to $100.
   * Search around the unrounded solution to find the MN that
   * produces the closest rounded competition salary pool.
   */
  const searchRange = 10;
  const step = 0.01;

  let bestMagicNumber = initialMagicNumber;
  let bestCalculatedSalaryPool =
    calculateCompetitionSalary(
      players,
      initialMagicNumber,
    );

  let bestDifference = Math.abs(
    bestCalculatedSalaryPool - targetSalaryPool,
  );

  for (
    let candidate =
      initialMagicNumber - searchRange;
    candidate <=
    initialMagicNumber + searchRange;
    candidate += step
  ) {
    const calculatedSalaryPool =
      calculateCompetitionSalary(
        players,
        candidate,
      );

    const difference = Math.abs(
      calculatedSalaryPool - targetSalaryPool,
    );

    if (difference < bestDifference) {
      bestMagicNumber = candidate;
      bestCalculatedSalaryPool =
        calculatedSalaryPool;
      bestDifference = difference;
    }
  }

  return {
    magicNumber:
      Math.round(bestMagicNumber * 100) / 100,
    targetSalaryPool,
    calculatedSalaryPool:
      bestCalculatedSalaryPool,
    salaryPoolDifference:
      bestCalculatedSalaryPool -
      targetSalaryPool,
    lockedSalary,
    changingPlayerPreviousSalary,
    changingPlayerAverageTotal,
    eligiblePlayers: eligiblePlayers.length,
    lockedPlayers: lockedPlayers.length,
  };
}