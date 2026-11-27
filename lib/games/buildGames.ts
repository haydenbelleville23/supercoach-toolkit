import type { Game, GamePlayer, GameTeamScore, RoundGamesFile } from "./types";

/** The fields used from data/{season}/fixtures-raw.json. */
export interface RawFixtureGame {
  id: number;
  kickoff: string;
  team1: { abbrev: string; name: string };
  team2: { abbrev: string; name: string };
  team1_score: number | null;
  team2_score: number | null;
  team1_score_verbose: string | null;
  team2_score_verbose: string | null;
  venue?: { name?: string; display_name?: string } | null;
  location?: string | null;
  match_status?: string | null;
}

export interface RawFixtureRound {
  round: number;
  response: RawFixtureGame[];
}

/** The fields used from data/{season}/player-details/{id}.json. */
export interface RawPlayerDetail {
  id: number;
  first_name: string;
  last_name: string;
  team: { abbrev: string } | null;
  positions?: { position: string }[];
  player_match_stats?: RawMatchStats[];
  player_stats?: RawRoundStats[];
}

export interface RawMatchStats {
  fixture_id: number;
  round: number;
  points?: number | null;
  minutes_played?: number | null;
  togp?: number | null;
  kicks?: number | null;
  handballs?: number | null;
  marks?: number | null;
  tackles?: number | null;
  hitouts?: number | null;
  goals?: number | null;
  behinds?: number | null;
}

export interface RawRoundStats {
  round: number;
  games?: number | null;
  price?: number | null;
  price_change?: number | null;
}

/** "{season}-{round}-{home}-{away}" with lowercase club codes. */
export function gameIdFor(season: number, round: number, home: string, away: string): string {
  return `${season}-${round}-${home.toLowerCase()}-${away.toLowerCase()}`;
}

/** Round number from a game id, or null if it isn't one. */
export function parseGameId(id: string): { season: number; round: number } | null {
  const match = /^(\d{4})-(\d{1,2})-[a-z]{3}-[a-z]{3}$/.exec(id);
  return match ? { season: Number(match[1]), round: Number(match[2]) } : null;
}

/** Every game in the round is complete with a score. */
export function isRoundComplete(round: RawFixtureRound): boolean {
  return (
    round.response.length > 0 &&
    round.response.every(
      (g) => g.match_status === "Complete" && typeof g.team1_score === "number" && typeof g.team2_score === "number",
    )
  );
}

/** "17.12.114" -> goals, behinds, total (checked against the total score). */
function parseScore(verbose: string | null, total: number | null, label: string): Omit<GameTeamScore, "team" | "teamName"> {
  const match = verbose ? /^(\d+)\.(\d+)\.(\d+)$/.exec(verbose.trim()) : null;
  if (!match || typeof total !== "number") {
    throw new Error(`${label}: no final score (got "${verbose}", ${total}).`);
  }
  const [goals, behinds, sum] = match.slice(1).map(Number);
  if (goals * 6 + behinds !== sum || sum !== total) {
    throw new Error(`${label}: score "${verbose}" doesn't add up to ${total}.`);
  }
  return { goals, behinds, total };
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Breakevens before and after a round, by player (see breakevens.ts). */
export interface BreakevenLookup {
  before: (round: number, playerId: number) => number | null;
  next: (round: number, playerId: number) => number | null;
}

function toPlayer(
  detail: RawPlayerDetail,
  team: string,
  match: RawMatchStats,
  round: RawRoundStats | undefined,
  roundNumber: number,
  breakevens: BreakevenLookup | undefined,
): GamePlayer {
  const kicks = num(match.kicks);
  const handballs = num(match.handballs);
  const tog = num(match.togp);
  const price = num(round?.price);
  const priceChange = num(round?.price_change);

  return {
    id: detail.id,
    name: `${detail.first_name} ${detail.last_name}`.trim(),
    team,
    positions: (detail.positions ?? []).map((p) => p.position),
    score: num(match.points) ?? 0,
    minutes: num(match.minutes_played),
    // 0% time on ground for a player who played means "not recorded".
    tog: tog !== null && tog > 0 ? tog : null,
    kicks,
    handballs,
    disposals: kicks !== null && handballs !== null ? kicks + handballs : null,
    marks: num(match.marks),
    tackles: num(match.tackles),
    hitouts: num(match.hitouts),
    goals: num(match.goals),
    behinds: num(match.behinds),
    price,
    priceChange,
    priceBefore: price !== null && priceChange !== null ? price - priceChange : null,
    breakeven: breakevens?.before(roundNumber, detail.id) ?? null,
    nextBreakeven: breakevens?.next(roundNumber, detail.id) ?? null,
  };
}

export interface BuildRoundResult {
  file: RoundGamesFile;
  /** Players who played but couldn't be linked to a game (skipped). */
  problems: string[];
}

/**
 * One round's games from the fixtures and the per-player files. Players
 * link to a game by its fixture id, checked against the round and the
 * player's club. Anything that doesn't line up is reported and skipped,
 * never guessed.
 */
export function buildRoundGames({
  season,
  round,
  players,
  breakevens,
}: {
  season: number;
  round: RawFixtureRound;
  players: readonly RawPlayerDetail[];
  /** Breakevens from the price engine; null fields without it. */
  breakevens?: BreakevenLookup;
}): BuildRoundResult {
  const problems: string[] = [];
  const byFixture = new Map<number, { home: GamePlayer[]; away: GamePlayer[]; game: RawFixtureGame }>();

  for (const game of round.response) {
    byFixture.set(game.id, { home: [], away: [], game });
  }

  for (const detail of players) {
    const name = `${detail.first_name} ${detail.last_name} (#${detail.id})`;
    const roundStats = detail.player_stats?.find((r) => r.round === round.round);
    const matches = (detail.player_match_stats ?? []).filter((m) => m.round === round.round);

    if (matches.length === 0) {
      if ((roundStats?.games ?? 0) > 0) {
        problems.push(`Round ${round.round}: ${name} played but has no match stats.`);
      }
      continue;
    }

    for (const match of matches) {
      const slot = byFixture.get(match.fixture_id);
      if (!slot) {
        problems.push(`Round ${round.round}: ${name} has fixture ${match.fixture_id}, which isn't in this round.`);
        continue;
      }

      const team = detail.team?.abbrev ?? "";
      const side =
        team === slot.game.team1.abbrev ? "home" : team === slot.game.team2.abbrev ? "away" : null;
      if (!side) {
        problems.push(
          `Round ${round.round}: ${name} (${team || "no club"}) isn't in ${slot.game.team1.abbrev} v ${slot.game.team2.abbrev}.`,
        );
        continue;
      }

      slot[side].push(toPlayer(detail, team, match, roundStats, round.round, breakevens));
    }
  }

  const bySc = (a: GamePlayer, b: GamePlayer) => b.score - a.score || a.name.localeCompare(b.name);

  const games: Game[] = round.response
    .map((g) => {
      const label = `Round ${round.round} ${g.team1.abbrev} v ${g.team2.abbrev}`;
      const home: GameTeamScore = {
        team: g.team1.abbrev,
        teamName: g.team1.name,
        ...parseScore(g.team1_score_verbose, g.team1_score, `${label} (${g.team1.abbrev})`),
      };
      const away: GameTeamScore = {
        team: g.team2.abbrev,
        teamName: g.team2.name,
        ...parseScore(g.team2_score_verbose, g.team2_score, `${label} (${g.team2.abbrev})`),
      };
      const margin = home.total - away.total;
      const slot = byFixture.get(g.id)!;

      return {
        id: gameIdFor(season, round.round, home.team, away.team),
        season,
        round: round.round,
        fixtureId: g.id,
        venue: g.venue?.display_name ?? g.venue?.name ?? g.location ?? "",
        kickoff: g.kickoff,
        home,
        away,
        margin,
        winner: margin === 0 ? null : margin > 0 ? home.team : away.team,
        quarters: null,
        players: { home: slot.home.sort(bySc), away: slot.away.sort(bySc) },
      };
    })
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id.localeCompare(b.id));

  return { file: { season, round: round.round, games }, problems };
}

/** "round-05.json" */
export function roundFileName(round: number): string {
  return `round-${String(round).padStart(2, "0")}.json`;
}
