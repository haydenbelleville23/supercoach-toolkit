"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";

import { WATCHLIST_FULL_MESSAGE, WATCHLIST_MAX } from "@/lib/watchlist/watchlist";
import type { Watchlist } from "@/lib/watchlist/useWatchlist";

/**
 * Watchlist toggle: a star button (filled when on). 24px wide so it fits
 * at the start of a table's player cell, with a 44px tap area around it.
 * When the list is full, the tooltip says so and a tap shows a short
 * message instead of adding.
 */
export default function WatchlistStar({
  playerId,
  playerName,
  watchlist,
  size = "sm",
  className = "",
}: {
  playerId: number;
  playerName: string;
  watchlist: Watchlist;
  /** "md" for headers (32px). */
  size?: "sm" | "md";
  className?: string;
}) {
  const on = watchlist.has(playerId);
  const blocked = !on && watchlist.isFull;
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const box = size === "md" ? "h-8 w-8" : "h-6 w-6";
  const icon = size === "md" ? "h-5 w-5" : "h-4 w-4";

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? `Remove ${playerName} from watchlist` : `Add ${playerName} to watchlist`}
        title={
          blocked
            ? `Watchlist full (${WATCHLIST_MAX} players)`
            : on
              ? "Remove from watchlist"
              : "Add to watchlist"
        }
        onClick={() => {
          const result = watchlist.toggle(playerId);
          setMessage(result.ok ? null : WATCHLIST_FULL_MESSAGE);
        }}
        // The ::after area makes the tap target 44px without widening the cell.
        className={`relative inline-flex ${box} items-center justify-center rounded-full transition after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
          on ? "text-amber-300" : blocked ? "text-slate-600" : "text-slate-500 hover:text-amber-200"
        }`}
      >
        <Star aria-hidden="true" className={icon} strokeWidth={2} fill={on ? "currentColor" : "none"} />
      </button>

      {message && (
        <span
          role="status"
          className="absolute left-full top-1/2 z-30 ml-1 w-48 -translate-y-1/2 whitespace-normal rounded-md border border-amber-400/50 bg-slate-950 px-2 py-1 text-[11px] font-normal leading-4 text-amber-100 shadow-lg"
        >
          {message}
        </span>
      )}
    </span>
  );
}
