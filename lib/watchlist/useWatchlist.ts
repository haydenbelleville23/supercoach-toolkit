"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { SEASON_YEAR } from "@/lib/season/seasonYear";

import {
  cleanEntries,
  emptyWatchlist,
  parseWatchlist,
  toggleWatchlist,
  watchlistKey,
  WATCHLIST_MAX,
  type ToggleResult,
  type WatchlistEntry,
  type WatchlistFile,
} from "./watchlist";

const listeners = new Set<() => void>();
const cache = new Map<number, { raw: string | null; file: WatchlistFile }>();

function readRaw(season: number): string | null {
  try {
    return window.localStorage.getItem(watchlistKey(season));
  } catch {
    return null;
  }
}

/** The stored watchlist for a season (empty when none, or storage is blocked). */
export function readWatchlist(season: number = SEASON_YEAR): WatchlistFile {
  const raw = readRaw(season);
  const cached = cache.get(season);
  if (cached && cached.raw === raw) return cached.file;

  let file = emptyWatchlist(season);
  try {
    file = raw === null ? file : parseWatchlist(JSON.parse(raw), season);
  } catch {
    // Unreadable: treated as empty.
  }

  cache.set(season, { raw, file });
  return file;
}

/**
 * Saves the list (unknown ids, duplicates and anything past the limit
 * are dropped) and notifies every component using useWatchlist.
 */
export function saveWatchlist(file: WatchlistFile, knownIds?: ReadonlySet<number>): void {
  const cleaned: WatchlistFile = { ...file, players: cleanEntries(file.players, knownIds) };
  try {
    window.localStorage.setItem(watchlistKey(file.season), JSON.stringify(cleaned));
  } catch {
    // Storage full or blocked: nothing saved.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith("footynomics.watchlist.")) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const SERVER_SNAPSHOT = emptyWatchlist(SEASON_YEAR);

export interface Watchlist {
  /** Entries for players that exist in the data (when knownIds is given), oldest first. */
  entries: WatchlistEntry[];
  ids: ReadonlySet<number>;
  count: number;
  isFull: boolean;
  has: (id: number) => boolean;
  /** Adds or removes the player. */
  toggle: (id: number) => ToggleResult;
}

/**
 * This season's watchlist. Pass the ids of the players on the page so
 * players no longer in the data are ignored (and dropped on the next save).
 */
export function useWatchlist(knownIds?: ReadonlySet<number>): Watchlist {
  const file = useSyncExternalStore(subscribe, () => readWatchlist(SEASON_YEAR), () => SERVER_SNAPSHOT);

  const entries = useMemo(
    () => (knownIds ? file.players.filter((entry) => knownIds.has(entry.id)) : file.players),
    [file, knownIds],
  );
  const ids = useMemo(() => new Set(entries.map((entry) => entry.id)), [entries]);

  const toggle = useCallback(
    (id: number) => {
      const result = toggleWatchlist(readWatchlist(SEASON_YEAR), id, new Date(), knownIds);
      if (result.ok) saveWatchlist(result.file, knownIds);
      return result;
    },
    [knownIds],
  );

  return {
    entries,
    ids,
    count: entries.length,
    isFull: entries.length >= WATCHLIST_MAX,
    has: (id: number) => ids.has(id),
    toggle,
  };
}
