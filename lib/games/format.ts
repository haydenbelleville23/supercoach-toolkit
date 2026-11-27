import { TEAMS } from "@/lib/teams";

import type { Game, GameTeamScore } from "./types";

const MELBOURNE = "Australia/Melbourne";

/** "Thu 9 Apr, 7:40 pm" in Melbourne time (the kickoff's offset is applied). */
export function formatKickoff(iso: string): string {
  // Built from parts so the format doesn't depend on locale data
  // (en-AU writes "June" and adds commas).
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: MELBOURNE,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  const dayPeriod = String(parts.dayPeriod ?? "").toLowerCase();
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute} ${dayPeriod}`.trim();
}

/** "17.12 (114)" */
export function formatScore(score: GameTeamScore): string {
  return `${score.goals}.${score.behinds} (${score.total})`;
}

/** "ADE by 28", or "Draw". */
export function resultLine(game: Game): string {
  if (game.winner === null) return "Draw";
  return `${game.winner} by ${Math.abs(game.margin)}`;
}

/** "R0" is Opening Round. */
export function roundLabel(round: number): string {
  return round === 0 ? "Opening Round" : `Round ${round}`;
}

/** Clubs with no game in a round (a bye), alphabetical. */
export function byeTeams(games: readonly Game[]): string[] {
  const playing = new Set(games.flatMap((g) => [g.home.team, g.away.team]));
  return Object.keys(TEAMS).filter((code) => !playing.has(code)).sort();
}
