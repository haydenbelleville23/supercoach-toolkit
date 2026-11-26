import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { getTeamFixture } from "@/lib/fixtures";
import { createSeasonRows } from "@/lib/priceEngine/createSeasonRows";
import { getProjectedScore } from "@/lib/projector/getProjectedScore";
import type { ProjectionMode } from "@/lib/projector/projectionModes";
import type { Player } from "@/types/player";
import type { SeasonProjectionRow } from "@/types/projection";

export function buildPlayerRows(
  player: Player,
  mode: ProjectionMode = "projected",
  existingRows?: SeasonProjectionRow[],
): SeasonProjectionRow[] {
  const rows = createSeasonRows();

  return rows.map((row) => {
    const teamFixture = getTeamFixture(
      player.team,
      row.round,
    );

    const historicalRow = player.history.find(
      (item) => item.round === row.round,
    );

    if (row.round <= CURRENT_COMPLETED_ROUND) {
      if (!historicalRow) {
        return {
          ...row,
          opponent: teamFixture?.opponent ?? null,
          homeAway: teamFixture?.homeAway ?? null,
        };
      }

      return {
        ...row,
        played: historicalRow.games > 0,
        isActual: true,
        score: historicalRow.score,

        price:
          row.round === CURRENT_COMPLETED_ROUND
            ? player.price
            : historicalRow.price,

        priceChange:
          row.round === CURRENT_COMPLETED_ROUND
            ? null
            : historicalRow.priceChange,

        breakEven:
          row.round === CURRENT_COMPLETED_ROUND
            ? player.breakeven
            : null,

        opponent:
          teamFixture?.opponent ??
          historicalRow.opponent,

        homeAway:
          teamFixture?.homeAway ??
          historicalRow.homeAway,
      };
    }

    // Bye: no game, so no score and the price holds.
    if (!teamFixture) {
      return {
        ...row,
        played: false,
        isActual: false,
        score: null,
        opponent: null,
        homeAway: null,
      };
    }

        const existingScore = existingRows?.find(
          (existingRow) =>
            existingRow.round === row.round,
        )?.score;
    
        const suggestedScore = getProjectedScore({
          player,
          round: row.round,
          completedRound: CURRENT_COMPLETED_ROUND,
          mode,
          existingScore,
        });
    
        return {
          ...row,
          played: true,
          isActual: false,
          score: suggestedScore,
          opponent: teamFixture?.opponent ?? null,
          homeAway: teamFixture?.homeAway ?? null,
        };
      });
    }
    