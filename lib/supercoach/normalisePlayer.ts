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

  const upcomingFixtures = [
    {
      round: stats.round + 1,
      opponent: stats.opp?.abbrev,
      homeAway: stats.opph === 1 ? ("H" as const) : ("A" as const),
    },
    {
      round: stats.round + 2,
      opponent: stats.opp1?.abbrev,
      homeAway: stats.opp1h === 1 ? ("H" as const) : ("A" as const),
    },
    {
      round: stats.round + 3,
      opponent: stats.opp2?.abbrev,
      homeAway: stats.opp2h === 1 ? ("H" as const) : ("A" as const),
    },
    {
      round: stats.round + 4,
      opponent: stats.opp3?.abbrev,
      homeAway: stats.opp3h === 1 ? ("H" as const) : ("A" as const),
    },
  ].filter(
    (
      fixture,
    ): fixture is {
      round: number;
      opponent: string;
      homeAway: "H" | "A";
    } => Boolean(fixture.opponent),
  );

  return {
    id: rawPlayer.id,
    name: `${rawPlayer.first_name} ${rawPlayer.last_name}`,
    team: rawPlayer.team.abbrev,
    teamName: rawPlayer.team.name,
    positions: rawPlayer.positions.map(
      (position) => position.position,
    ),
    price: stats.price,
    games: stats.total_games,
    average: stats.avg,
    average3: stats.avg3,
    average5: stats.avg5,
    recentScores: [],
    breakeven: stats.be1,
    projectedBreakEvens: [
      stats.be1,
      stats.be2,
      stats.be3,
    ],
    projectedScore: stats.ppts,
    projectedScores: [
      stats.ppts1,
      stats.ppts2,
      stats.ppts3,
    ],
    projectedPrices: [
      stats.pp1,
      stats.pp2,
      stats.pp3,
    ],
    projectedPriceChanges: [
      stats.ppc1,
      stats.ppc2,
      stats.ppc3,
    ],
    ownership: stats.own,
    active: rawPlayer.active,
    availability:
      rawPlayer.injury_suspension_status_text ??
      rawPlayer.injury_suspension_status,
    upcomingFixtures,
  };
}