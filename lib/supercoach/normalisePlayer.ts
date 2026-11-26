import type { Player, PlayerHistoryRow } from "@/types/player";
import type { SuperCoachPlayer } from "@/types/supercoach";

import { latestPricedRound, rebuildFromHistory } from "./publicPlayerState";

/**
 * Normalises one player from the public per-player SuperCoach data.
 *
 * Price, games, averages and recent scores come from the player's public
 * round-by-round history, as of their latest priced round. The breakeven
 * needs the whole league, so it is 0 here and filled in by the build
 * (withScaledBreakevens). Ownership has no public source yet: null.
 */
export function normaliseSuperCoachPlayer(
  rawPlayer: SuperCoachPlayer,
): Player {
  const history: PlayerHistoryRow[] = (rawPlayer.player_stat_history ?? [])
    .map((item) => ({
      round: item.round,

      score: Number(item.games ?? 0) > 0 ? Number(item.points ?? 0) : null,

      price: item.price == null ? null : Number(item.price),

      priceChange:
        item.round === 0 ? null : Number(item.price_change ?? 0),

      games: Number(item.games ?? 0),

      opponent: item.opp?.abbrev ?? null,

      homeAway:
        item.opph === 1
          ? ("H" as const)
          : item.opph === 0
            ? ("A" as const)
            : null,
    }))
    .sort((a, b) => a.round - b.round);

  const round = latestPricedRound({ history });

  if (round === null) {
    throw new Error(
      `Player ${rawPlayer.id} has no published price in their history.`,
    );
  }

  const player: Player = {
    id: rawPlayer.id,
    championDataId:
      rawPlayer.feed_id == null
        ? null
        : rawPlayer.feed_id.startsWith("CD_I")
          ? rawPlayer.feed_id
          : `CD_I${rawPlayer.feed_id}`,
    name: `${rawPlayer.first_name} ${rawPlayer.last_name}`,
    team: rawPlayer.team?.abbrev ?? "UNK",
    teamName: rawPlayer.team?.name ?? "Unknown",
    positions: rawPlayer.positions.map((position) => position.position),

    price: 0,
    games: 0,
    average: 0,
    average3: 0,
    average5: 0,
    recentScores: [],
    history,
    breakeven: 0,

    ownership: null,
    active: Boolean(rawPlayer.active),

    availability:
      rawPlayer.injury_suspension_status_text ??
      rawPlayer.injury_suspension_status ??
      null,
  };

  return rebuildFromHistory(player, round);
}
