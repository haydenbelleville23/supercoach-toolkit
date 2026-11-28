"use client";

import { useId, useState, type KeyboardEvent } from "react";

import WatchlistTable from "@/components/watchlist/WatchlistTable";
import { useWatchlist } from "@/lib/watchlist/useWatchlist";

import MyTeamTool from "./MyTeamTool";

type Tab = "squad" | "watchlist";

const TABS: { id: Tab; label: string }[] = [
  { id: "squad", label: "Squad" },
  { id: "watchlist", label: "Watchlist" },
];

/** My Team's two tabs: the squad editor and the watchlist. */
export default function MyTeamTabs() {
  const [tab, setTab] = useState<Tab>("squad");
  const baseId = useId();
  const watchlist = useWatchlist();

  const select = (next: Tab) => {
    setTab(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      select(tab === "squad" ? "watchlist" : "squad");
    }
  };

  return (
    <>
      <div
        role="tablist"
        aria-label="My Team"
        onKeyDown={onKeyDown}
        className="mb-5 mt-4 inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            id={`${baseId}-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`${baseId}-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-lg px-5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
              tab === id ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            {label}
            {id === "watchlist" && <span className="ml-2 opacity-70">{watchlist.count}</span>}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${tab}`}
        aria-labelledby={`${baseId}-tab-${tab}`}
      >
        {tab === "squad" ? <MyTeamTool /> : <WatchlistTable />}
      </div>
    </>
  );
}
