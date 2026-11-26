import { normaliseSearchText, searchPlayers } from "@/lib/players/playerSearch";
import { TEAMS } from "@/lib/teams";
import type { Player } from "@/types/player";

/** Club nicknames and other names lists use, by team code. */
const TEAM_ALIASES: Record<string, string[]> = {
  ADE: ["crows"],
  BRL: ["lions", "brisbane lions"],
  CAR: ["blues"],
  COL: ["magpies", "pies"],
  ESS: ["bombers", "dons"],
  FRE: ["dockers"],
  GEE: ["cats"],
  GCS: ["suns", "gold coast suns"],
  GWS: ["giants", "greater western sydney", "gws giants"],
  HAW: ["hawks"],
  MEL: ["demons", "dees"],
  NTH: ["kangaroos", "roos", "north", "north melbourne"],
  PTA: ["power", "port", "port adelaide"],
  RIC: ["tigers"],
  STK: ["saints"],
  SYD: ["swans"],
  WCE: ["eagles", "west coast", "west coast eagles"],
  WBD: ["bulldogs", "dogs", "western bulldogs", "footscray"],
};

/** Team code from a code, club name or nickname ("Crows", "GWS Giants"); null if not recognised. */
export function resolveTeam(text: string): string | null {
  const t = normaliseSearchText(text);
  if (!t) return null;

  for (const team of Object.values(TEAMS)) {
    const names = [team.code, team.name, team.shortName, ...(TEAM_ALIASES[team.code] ?? [])].map(
      normaliseSearchText,
    );
    if (names.includes(t)) return team.code;
  }

  return null;
}

export type MatchablePlayer = Pick<Player, "id" | "name" | "team" | "teamName" | "positions">;

export type NameMatch<P extends MatchablePlayer = MatchablePlayer> =
  | { kind: "matched"; player: P }
  | { kind: "ambiguous"; reason: string; candidates: P[] }
  | { kind: "unmatched"; reason: string; suggestions: P[] };

const compact = (name: string) => normaliseSearchText(name).replace(/ /g, "");

/**
 * Finds a list row's player by name plus team. Names compare without case,
 * accents, spaces or punctuation ("Davies-Uniacke" = "Davies Uniacke").
 * Never guesses: no exact name, a team that doesn't match, or two players
 * with the name and no team to tell them apart are reported with
 * suggestions instead.
 */
export function matchPlayer<P extends MatchablePlayer>(
  players: readonly P[],
  name: string,
  teamText: string,
): NameMatch<P> {
  const key = compact(name);
  const team = resolveTeam(teamText);
  const sameName = players.filter((p) => compact(p.name) === key);

  const suggest = () => {
    const surname = normaliseSearchText(name).split(" ").slice(1).join(" ") || name;
    const found = searchPlayers(players as unknown as Player[], surname) as unknown as P[];
    const ranked = [...found.filter((p) => p.team === team), ...found.filter((p) => p.team !== team)];
    return [...new Set([...sameName, ...ranked])].slice(0, 3);
  };

  if (teamText.trim() && !team) {
    return { kind: "unmatched", reason: `team "${teamText}" not recognised`, suggestions: suggest() };
  }

  if (sameName.length === 0) {
    return { kind: "unmatched", reason: "no player with that name", suggestions: suggest() };
  }

  const candidates = team ? sameName.filter((p) => p.team === team) : sameName;

  if (candidates.length === 1) {
    return { kind: "matched", player: candidates[0] };
  }

  if (candidates.length === 0) {
    return {
      kind: "unmatched",
      reason: `no ${name} at ${team}`,
      suggestions: suggest(),
    };
  }

  return {
    kind: "ambiguous",
    reason: team ? `${candidates.length} players named ${name} at ${team}` : `${candidates.length} players named ${name}; add the team`,
    candidates,
  };
}
