"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, kept up to date. `serverValue` is
 * used while rendering on the server and during hydration.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : serverValue),
    () => serverValue,
  );
}

/** Tailwind's sm breakpoint and up (640px). */
export const SM_UP = "(min-width: 640px)";
