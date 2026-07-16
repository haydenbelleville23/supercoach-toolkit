import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { createPlayerState } from "@/lib/priceEngine/createPlayerState";
import { projectSeason } from "@/lib/priceEngine/projectSeason";
import type { Player } from "@/types/player";
import type { SeasonProjectionRow } from "@/types/projection";
  
 export function calculateProjectionRows(
    rowsToCalculate: SeasonProjectionRow[],
    player: Player,
  ): SeasonProjectionRow[] {
    const state = createPlayerState(player);

    const futureRows = rowsToCalculate.filter(
      (row) =>
        row.round > CURRENT_COMPLETED_ROUND,
    );

    const projectedScores = futureRows.map(
      (row) =>
        row.score ?? Math.round(player.average),
    );

    const projections = projectSeason(
      state,
      projectedScores,
    );

    let projectionIndex = 0;

    return rowsToCalculate.map((row) => {
      if (row.round < CURRENT_COMPLETED_ROUND) {
        return row;
      }

      if (
        row.round === CURRENT_COMPLETED_ROUND
      ) {
        return {
          ...row,
          price: player.price,
          priceChange: null,
        };
      }

      if (!row.played || row.score === null) {
        return {
          ...row,
          breakEven: null,
          price: null,
          priceChange: null,
          threeRoundAverage: null,
        };
      }

      const projection =
        projections[projectionIndex++];

      if (!projection) {
        return row;
      }

      return {
        ...row,
        breakEven: projection.breakEven,
        price: projection.price,
        priceChange: projection.priceChange,
        threeRoundAverage:
          projection.threeRoundAverage,
        magicNumber: projection.magicNumber,
      };
    });
  }
