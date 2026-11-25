import type { Player } from "@/types/player";
import type { ScaledRoundPlayerInput } from "./calculateScaledRoundPrices";
import { getLastThreeScores } from "./getLastThreeScores";

export interface ScaledRoundInputRow extends ScaledRoundPlayerInput {
  /** Published price after this round, or null if not yet published. */
  actualPrice: number | null;
}

export interface ScaledRoundInputs {
  round: number;
  /** Players priced in both the previous round and this round. */
  players: ScaledRoundInputRow[];
  /** Previous round's actual total of all published prices (anchor X). */
  anchorTotal: number;
}

/**
 * Builds the scaled-model inputs for a round from player history, with the
 * same eligibility rules as evaluateMagicNumber and scripts/backtest-pricing.ts:
 * a score this round plus at least three scores to date (getLastThreeScores).
 *
 * Players first priced this round (e.g. mid-season draftees) are left out:
 * they have no old price and enter at their own published price.
 */
export function buildScaledRoundInputs(
  players: Player[],
  round: number,
): ScaledRoundInputs {
  const rows: ScaledRoundInputRow[] = [];
  let anchorTotal = 0;

  for (const player of players) {
    const previous = player.history.find((h) => h.round === round - 1);
    const current = player.history.find((h) => h.round === round);

    if (previous?.price != null) {
      anchorTotal += previous.price;
    }

    if (
      !previous ||
      previous.price == null ||
      !current ||
      current.price == null
    ) {
      continue;
    }

    const lastThree = getLastThreeScores(player.history, round);
    const played = current.score !== null;

    rows.push({
      playerId: player.id,
      oldPrice: previous.price,
      actualPrice: current.price,
      category: !played
        ? "didNotPlay"
        : lastThree === null
          ? "under3"
          : "eligible",
      threeRoundAverage:
        lastThree === null
          ? 0
          : (lastThree[0] + lastThree[1] + lastThree[2]) / 3,
    });
  }

  return { round, players: rows, anchorTotal };
}
