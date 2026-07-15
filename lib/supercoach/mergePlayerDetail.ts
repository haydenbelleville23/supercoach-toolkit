import type { SuperCoachPlayer } from "@/types/supercoach";

export function mergePlayerDetail(
  basePlayer: SuperCoachPlayer,
  detailPlayer: SuperCoachPlayer | undefined,
): SuperCoachPlayer {
  if (!detailPlayer) {
    return basePlayer;
  }

  return {
    ...basePlayer,
    ...detailPlayer,

    team: detailPlayer.team ?? basePlayer.team,

    positions:
      detailPlayer.positions ?? basePlayer.positions,

    player_stats:
      detailPlayer.player_stats ??
      basePlayer.player_stats,

    player_match_stats:
      detailPlayer.player_match_stats ??
      basePlayer.player_match_stats,
  };
}