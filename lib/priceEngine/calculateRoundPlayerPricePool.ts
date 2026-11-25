import type { Player } from "@/types/player";

export interface RoundPlayerPricePool {
  round: number;
  totalPricePool: number;
  playersIncluded: number;
  playersMissingPrice: number;
}

export function calculateRoundPlayerPricePool(
  players: Player[],
  round: number,
): RoundPlayerPricePool {
  let totalPricePool = 0;
  let playersIncluded = 0;
  let playersMissingPrice = 0;

  for (const player of players) {
    const historyRow = player.history.find(
      (history) => history.round === round,
    );

    if (
      historyRow?.price === null ||
      historyRow?.price === undefined
    ) {
      playersMissingPrice += 1;
      continue;
    }

    totalPricePool += historyRow.price;
    playersIncluded += 1;
  }

  return {
    round,
    totalPricePool,
    playersIncluded,
    playersMissingPrice,
  };
}