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

const teamAbbrev = rawPlayer.team?.abbrev ?? "UNK";
const teamName = rawPlayer.team?.name ?? "Unknown";

const playedMatchStats = (
  rawPlayer.player_match_stats ?? []
)
  .filter(
    (match) =>
      match.games > 0 &&
      Number.isFinite(match.points),
  )
  .sort((a, b) => a.round - b.round);

const scoreHistory = playedMatchStats.map(
  (match) => match.points,
);

const history = (rawPlayer.player_stat_history ?? [])
  .map((item) => ({
    round: item.round,

    score:
      item.games > 0
        ? Number(item.points ?? 0)
        : null,

    price:
      item.price == null
        ? null
        : Number(item.price),

    priceChange:
      item.round === 0
        ? null
        : Number(item.price_change ?? 0),

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

    const price = Number(stats.price ?? 0);
  const games = Number(stats.total_games ?? 0);
  const average = Number(stats.avg ?? 0);
  const average3 = Number(stats.avg3 ?? average);
  const average5 = Number(stats.avg5 ?? average);
  const breakeven = Number(stats.be1 ?? 0);
  const ownership = Number(stats.own ?? 0);

  return {
    id: rawPlayer.id,
    name: `${rawPlayer.first_name} ${rawPlayer.last_name}`,
     team: teamAbbrev,
    teamName,
    positions: rawPlayer.positions.map(
      (position) => position.position,
    ),

    price,
    games,
    average,
    average3,
    average5,
    recentScores: scoreHistory,
    history,
    breakeven,

    projectedBreakEvens: [
      Number(stats.be1 ?? breakeven),
      Number(stats.be2 ?? breakeven),
      Number(stats.be3 ?? breakeven),
    ],

    projectedScore: Number(
      stats.ppts ?? Math.round(average),
    ),

    projectedScores: [
      Number(stats.ppts1 ?? Math.round(average)),
      Number(stats.ppts2 ?? Math.round(average)),
      Number(stats.ppts3 ?? Math.round(average)),
    ],

    projectedPrices: [
      Number(stats.pp1 ?? price),
      Number(stats.pp2 ?? price),
      Number(stats.pp3 ?? price),
    ],

    projectedPriceChanges: [
      Number(stats.ppc1 ?? 0),
      Number(stats.ppc2 ?? 0),
      Number(stats.ppc3 ?? 0),
    ],

    ownership,
    active: Boolean(rawPlayer.active),

    availability:
      rawPlayer.injury_suspension_status_text ??
      rawPlayer.injury_suspension_status ??
      null,

    upcomingFixtures,
  };
}