/**
 * The Live page's selected match in the address: ?game=<id>, where id is
 * the DFS feed's own fixture id (a whole number).
 */
export const GAME_PARAM = "game";

/** A positive whole-number id, or null for anything else (missing or malformed). */
export function parseGameParam(value: string | null | undefined): number | null {
  if (!value || !/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

/**
 * The match to show: the one in the address when the feed has it,
 * otherwise the page's own selection (its default, or the last pick).
 */
export function resolveSelectedFixtureId(
  fixtures: readonly { id: number }[],
  requested: number | null,
  fallback: number | null,
): number | null {
  if (requested !== null && fixtures.some((fixture) => fixture.id === requested)) {
    return requested;
  }
  return fallback;
}

/** The query string with ?game set to id, keeping every other parameter. */
export function withGameParam(search: string, id: number): string {
  const params = new URLSearchParams(search);
  params.set(GAME_PARAM, String(id));
  return `?${params.toString()}`;
}
