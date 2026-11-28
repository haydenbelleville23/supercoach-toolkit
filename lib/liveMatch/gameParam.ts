import { parseGameId } from "@/lib/games/buildGames";

/**
 * The Live page's selected match in the address: ?game=<id>, using the
 * results archive's game ids ("2026-10-brl-gee": season, round, home and
 * away club codes in lowercase), so a Live link and a results link name a
 * game the same way.
 */
export const GAME_PARAM = "game";

/** A well-formed game id ("2026-10-brl-gee"), or null for anything else. */
export function parseGameParam(value: string | null | undefined): string | null {
  if (!value) return null;
  const id = value.trim().toLowerCase();
  return parseGameId(id) ? id : null;
}

/**
 * The match to show: the one in the address when the feed has it,
 * otherwise the page's own selection (its default, or the last pick).
 * gameIdOf gives a feed fixture's game id (null when it can't be placed
 * in the season's fixture).
 */
export function resolveSelectedFixtureId<F extends { id: number }>(
  fixtures: readonly F[],
  requested: string | null,
  gameIdOf: (fixture: F) => string | null,
  fallback: number | null,
): number | null {
  if (requested !== null) {
    const match = fixtures.find((fixture) => gameIdOf(fixture) === requested);
    if (match) return match.id;
  }
  return fallback;
}

/**
 * The query string with ?game set to the game id (or removed when null),
 * keeping every other parameter.
 */
export function withGameParam(search: string, gameId: string | null): string {
  const params = new URLSearchParams(search);
  if (gameId === null) {
    params.delete(GAME_PARAM);
  } else {
    params.set(GAME_PARAM, gameId);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
