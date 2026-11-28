"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "footynomics.matchup-adjustment.v1";
const EVENT = "footynomics:matchup-adjustment";

function read(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onChange);
  };
}

/**
 * The "Matchup adjustment" switch: on by default, remembered in this
 * browser and shared by the Projector and the Trade Planner.
 */
export function useMatchupSetting(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => true);

  const set = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Storage blocked: the switch still works for this page view.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [on, set];
}
