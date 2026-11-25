"use client";

import { useSyncExternalStore } from "react";

import { parseTeamFile } from "./teamFile";
import type { MyTeam } from "./types";

/** The saved team lives in the browser only (no account or database). */
const STORAGE_KEY = "fantasy-king.my-team.v1";

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

    cachedTeam = typeof parsed === "string" ? null : parsed;
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

/** Downloads the team as a JSON file. */
export function exportMyTeam(team: MyTeam): void {
  const blob = new Blob([JSON.stringify(team, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `fantasy-king-team-round-${team.asOfRound}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

/** Reads an imported JSON file; returns the team or an error message. */
export async function importMyTeam(file: File): Promise<MyTeam | string> {
  try {
    return parseTeamFile(JSON.parse(await file.text()));
  } catch {
    return "That file isn't valid JSON.";
  }
}
