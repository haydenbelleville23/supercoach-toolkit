"use client";

import { useSyncExternalStore } from "react";

import { SEASON_YEAR } from "@/lib/season/seasonYear";
import { readWatchlist } from "@/lib/watchlist/useWatchlist";
import { cleanEntries, type WatchlistEntry } from "@/lib/watchlist/watchlist";

import { parseTeamFile } from "./teamFile";
import type { MyTeam } from "./types";

/**
 * The saved team lives in the browser only (no account or database), one
 * per season. 2026 keeps the key it always had, so nothing is migrated;
 * later seasons get their own key and start empty.
 */
export function myTeamKey(season: number): string {
  return season === 2026 ? "footynomics.my-team.v1" : `footynomics.my-team.v1.${season}`;
}

const STORAGE_KEY = myTeamKey(SEASON_YEAR);

const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedTeam: MyTeam | null = null;

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): MyTeam | null {
  const raw = readStorage();

  if (raw !== cachedRaw) {
    cachedRaw = raw;

    let parsed: MyTeam | string | null = null;

    try {
      parsed = raw === null ? null : parseTeamFile(JSON.parse(raw));
    } catch {
      parsed = null;
    }

    // A team saved for another season isn't this season's team.
    cachedTeam = typeof parsed === "string" || parsed?.season !== SEASON_YEAR ? null : parsed;
  }

  return cachedTeam;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Saves the team and notifies every component using useMyTeam. */
export function saveMyTeam(team: MyTeam | null): void {
  try {
    if (team === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...team, updatedAt: new Date().toISOString() }),
      );
    }
  } catch {
    // Storage full or blocked: the in-page state is unchanged.
  }

  listeners.forEach((listener) => listener());
}

/** The saved team (null when none is saved, and during server rendering). */
export function useMyTeam(): MyTeam | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/**
 * The exported file: the team, plus the season's watchlist. The team
 * file stays version 1; older files without a watchlist still import.
 */
export function teamExportFile(
  team: MyTeam,
  watchlist: WatchlistEntry[],
): MyTeam & { watchlist: WatchlistEntry[] } {
  return { ...team, watchlist };
}

/** Downloads the team (and this season's watchlist) as a JSON file. */
export function exportMyTeam(team: MyTeam): void {
  const file = teamExportFile(team, readWatchlist(team.season).players);
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `footynomics-team-round-${team.asOfRound}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

export interface ImportedTeam {
  team: MyTeam;
  /** Null when the file has no watchlist (exports from before it existed). */
  watchlist: WatchlistEntry[] | null;
}

/** Checks a parsed export: the team (without the watchlist) and the watchlist. */
export function parseTeamExport(value: unknown): ImportedTeam | string {
  const team = parseTeamFile(value);
  if (typeof team === "string") return team;

  const raw = (value as { watchlist?: unknown }).watchlist;
  const { watchlist: _dropped, ...teamOnly } = team as MyTeam & { watchlist?: unknown };
  void _dropped;

  return {
    team: teamOnly,
    watchlist: Array.isArray(raw) ? cleanEntries(raw) : null,
  };
}

/** Reads an imported JSON file; returns the team and watchlist, or an error message. */
export async function importMyTeam(file: File): Promise<ImportedTeam | string> {
  try {
    return parseTeamExport(JSON.parse(await file.text()));
  } catch {
    return "That file isn't valid JSON.";
  }
}
