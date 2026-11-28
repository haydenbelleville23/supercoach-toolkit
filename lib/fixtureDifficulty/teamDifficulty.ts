import type { Player } from "../../types/player";

export interface TeamDifficulty {
  team: string;
  games: number;
  /** Average total SuperCoach points scored per game. */
  pointsFor: number;
  /** Average total SuperCoach points conceded per game. */
  pointsAgainst: number;
  /** Against minus For: positive = a soft team to play (easy). */
  net: number;
}

/**
 * Each team's total SuperCoach points per game (the sum of its players'
 * scores in that game) and the total its opponents score against it, from
 * rounds up to `asOfRound`.
 *
 * Who counts as playing: every player with a recorded game that round
 * (games > 0), substitutes included. A game is a (round, team) pair with
 * at least one recorded player; its opponent is the opponent on those
 * players' records.
 */
export function computeTeamDifficulty(players: readonly Player[], asOfRound: number): TeamDifficulty[] {
  // "round:team" -> { total, opponent }
  const games = new Map<string, { round: number; team: string; opponent: string; total: number }>();

  for (const player of players) {
    for (const h of player.history) {
      if (h.round > asOfRound || !(h.games > 0) || typeof h.score !== "number" || !h.opponent) continue;
      const key = `${h.round}:${player.team}`;
      const game = games.get(key) ?? { round: h.round, team: player.team, opponent: h.opponent, total: 0 };
      game.total += h.score;
      games.set(key, game);
    }
  }

  const byTeam = new Map<string, { for: number; against: number; games: number }>();
  for (const game of games.values()) {
    const against = games.get(`${game.round}:${game.opponent}`);
    if (!against) continue; // opponent has no recorded players: skip the game
    const row = byTeam.get(game.team) ?? { for: 0, against: 0, games: 0 };
    row.for += game.total;
    row.against += against.total;
    row.games += 1;
    byTeam.set(game.team, row);
  }

  return [...byTeam]
    .map(([team, row]) => {
      const pointsFor = row.for / row.games;
      const pointsAgainst = row.against / row.games;
      return { team, games: row.games, pointsFor, pointsAgainst, net: pointsAgainst - pointsFor };
    })
    .sort((a, b) => a.team.localeCompare(b.team));
}

/** One game's totals, e.g. for checking against SuperCoach's gameday totals. */
export function gameTotals(players: readonly Player[], round: number, team: string): number {
  return players
    .filter((p) => p.team === team)
    .reduce((t, p) => {
      const h = p.history.find((row) => row.round === round && row.games > 0);
      return t + (typeof h?.score === "number" ? h.score : 0);
    }, 0);
}
