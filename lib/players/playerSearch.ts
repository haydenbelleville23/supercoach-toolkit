import { getTeam } from "@/lib/teams";
import type { Player } from "@/types/player";

/**
 * Lowercase, accents removed, apostrophes and full stops dropped, and
 * hyphens and other punctuation turned into spaces: "O'Brien" -> "obrien",
 * "Davies-Uniacke" -> "davies uniacke", "Zoë" -> "zoe".
 */
export function normaliseSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface SearchEntry {
  /** Normalised words of the full name. */
  nameWords: string[];
  /** Full name with no spaces ("luke davies uniacke" -> "lukedaviesuniacke"). */
  compactName: string;
  /** Surname (everything after the first name), with no spaces. */
  compactSurname: string;
  firstName: string;
  /** Team code, full name and short name words. */
  teamWords: string[];
  /** Team code, lowercase ("mel"). */
  teamCode: string;
  /** Positions, lowercase ("mid", "fwd"). */
  positions: string[];
}

// One index entry per player object, shared by every select on the page.
const index = new WeakMap<Player, SearchEntry>();

function entryFor(player: Player): SearchEntry {
  const cached = index.get(player);
  if (cached) {
    return cached;
  }

  const nameWords = normaliseSearchText(player.name).split(" ").filter(Boolean);
  const team = getTeam(player.team);
  const teamWords = normaliseSearchText(
    [player.team, player.teamName, team?.name ?? "", team?.shortName ?? ""].join(" "),
  )
    .split(" ")
    .filter(Boolean);

  const entry: SearchEntry = {
    nameWords,
    compactName: nameWords.join(""),
    compactSurname: nameWords.slice(1).join("") || nameWords.join(""),
    firstName: nameWords[0] ?? "",
    teamWords,
    teamCode: player.team.toLowerCase(),
    positions: player.positions.map((p) => p.toLowerCase()),
  };

  index.set(player, entry);
  return entry;
}

/**
 * How well a player matches a query, lower is better, or null for no match.
 *
 * 0  surname starts with the query ("uni", "davies-u", "de goey")
 * 1  first name or full name starts with it ("max", "max ga")
 * 2  every word of the query starts a name word, or (3+ letters) is
 *    inside the name
 * 3  matches the exact team code ("mel") or an exact position ("ruc"),
 *    with any other words matching the name
 * 4  matches a word of the team name ("melb", "north"), likewise
 */
export function matchRank(player: Player, query: string): number | null {
  const q = normaliseSearchText(query);
  if (!q) {
    return 0;
  }

  const entry = entryFor(player);
  const compactQuery = q.replace(/ /g, "");

  if (entry.compactSurname.startsWith(compactQuery)) {
    return 0;
  }

  if (entry.firstName.startsWith(compactQuery) || entry.compactName.startsWith(compactQuery)) {
    return 1;
  }

  const tokens = q.split(" ");
  const inName = (token: string) =>
    entry.nameWords.some((word) => word.startsWith(token)) ||
    // Inside a name only from 3 letters, so "davies u" doesn't find Hugh Davies.
    (token.length >= 3 && entry.compactName.includes(token));

  if (tokens.every(inName)) {
    return 2;
  }

  const exact = (token: string) => token === entry.teamCode || entry.positions.includes(token);
  const inTeam = (token: string) =>
    exact(token) || entry.teamWords.some((word) => word.startsWith(token));

  if (tokens.every((token) => inName(token) || inTeam(token)) && tokens.some(inTeam)) {
    return tokens.some(exact) ? 3 : 4;
  }

  return null;
}

/**
 * Players matching a query, best first; ties keep the input order, so the
 * result is stable. An empty query returns every player in input order.
 */
export function searchPlayers(players: readonly Player[], query: string): Player[] {
  if (!normaliseSearchText(query)) {
    return [...players];
  }

  const ranked: { player: Player; rank: number; order: number }[] = [];

  players.forEach((player, order) => {
    const rank = matchRank(player, query);
    if (rank !== null) {
      ranked.push({ player, rank, order });
    }
  });

  ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return ranked.map((r) => r.player);
}
