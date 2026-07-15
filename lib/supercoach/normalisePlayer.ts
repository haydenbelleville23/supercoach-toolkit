import type { Player } from "@/types/player";
import type { SuperCoachPlayer } from "@/types/supercoach";

export function normaliseSuperCoachPlayer(
  rawPlayer: SuperCoachPlayer,
): Player {
  const stats = rawPlayer.player_stats[0];

  if (!stats) {
    throw new Error(
      `Player ${rawPlayer.id} does not contain player statistics.`,
    );
  }

  return {
    id: rawPlayer.id,
    name: `${rawPlayer.first_name} ${rawPlayer.last_name}`,
    team: rawPlayer.team.abbrev,
    teamName: rawPlayer.team.name,
    positions: rawPlayer.positions.map((position) => position.position),
    price: stats.price,
    average: stats.avg,
    average3: stats.avg3,
    average5: stats.avg5,
    breakeven: stats.be1,
    projectedScore: stats.ppts,
    projectedScores: [stats.ppts1, stats.ppts2, stats.ppts3],
    projectedPrices: [stats.pp1, stats.pp2, stats.pp3],
    projectedPriceChanges: [stats.ppc1, stats.ppc2, stats.ppc3],
    ownership: stats.own,
    active: rawPlayer.active,
    availability:
      rawPlayer.injury_suspension_status_text ??
      rawPlayer.injury_suspension_status,
  };
}