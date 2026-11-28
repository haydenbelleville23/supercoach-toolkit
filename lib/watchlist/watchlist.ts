/**
 * The watchlist: players a coach wants to keep an eye on, saved in this
 * browser only (no account). Same pattern as My Team: localStorage, a
 * versioned file, checked on the way in. Unlike My Team, the key is
 * per season, so a new season starts with an empty list.
 *
 * Pure functions only; useWatchlist.ts reads and writes storage.
 */

export const WATCHLIST_VERSION = 1;
export const WATCHLIST_MAX = 60;

export interface WatchlistEntry {
  id: number;
  /** ISO date-time the player was added. */
  addedAt: string;
}

export interface WatchlistFile {
  version: typeof WATCHLIST_VERSION;
  season: number;
  players: WatchlistEntry[];
}

export function watchlistKey(season: number): string {
  return `footynomics.watchlist.${season}`;
}

export function emptyWatchlist(season: number): WatchlistFile {
  return { version: WATCHLIST_VERSION, season, players: [] };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPlayerId = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

/**
 * Entries from any list: { id, addedAt } objects (version 1) or bare ids
 * (an unversioned list). Invalid ids and duplicates are dropped (the
 * first wins), and the list is capped at WATCHLIST_MAX.
 */
export function cleanEntries(
  value: unknown,
  knownIds?: ReadonlySet<number>,
  fallbackDate = new Date(0).toISOString(),
): WatchlistEntry[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<number>();
  const entries: WatchlistEntry[] = [];

  for (const item of value) {
    const id = isRecord(item) ? item.id : item;
    if (!isPlayerId(id) || seen.has(id)) continue;
    if (knownIds && !knownIds.has(id)) continue;

    seen.add(id);
    entries.push({
      id,
      addedAt:
        isRecord(item) && typeof item.addedAt === "string" && !Number.isNaN(Date.parse(item.addedAt))
          ? item.addedAt
          : fallbackDate,
    });

    if (entries.length === WATCHLIST_MAX) break;
  }

  return entries;
}

/**
 * Reads a stored watchlist for a season. Migrations: a bare array of ids
 * (no version) becomes version 1. Anything unreadable, a newer version,
 * or another season's list gives an empty list.
 */
export function parseWatchlist(value: unknown, season: number): WatchlistFile {
  if (Array.isArray(value)) {
    return { version: WATCHLIST_VERSION, season, players: cleanEntries(value) };
  }

  if (!isRecord(value) || value.version !== WATCHLIST_VERSION) {
    return emptyWatchlist(season);
  }

  if (typeof value.season === "number" && value.season !== season) {
    return emptyWatchlist(season);
  }

  return { version: WATCHLIST_VERSION, season, players: cleanEntries(value.players) };
}

export type ToggleResult =
  | { ok: true; file: WatchlistFile; added: boolean }
  | { ok: false; reason: "full" };

/** Adds the player, or removes them if already listed. Refuses past the limit. */
export function toggleWatchlist(
  file: WatchlistFile,
  id: number,
  now: Date = new Date(),
  knownIds?: ReadonlySet<number>,
): ToggleResult {
  const players = cleanEntries(file.players, knownIds);

  if (players.some((entry) => entry.id === id)) {
    return { ok: true, added: false, file: { ...file, players: players.filter((entry) => entry.id !== id) } };
  }

  if (players.length >= WATCHLIST_MAX) {
    return { ok: false, reason: "full" };
  }

  return {
    ok: true,
    added: true,
    file: { ...file, players: [...players, { id, addedAt: now.toISOString() }] },
  };
}

export const WATCHLIST_FULL_MESSAGE = `Your watchlist is full (${WATCHLIST_MAX} players). Remove a player to add another.`;
