"use client";

import { useRef, useState } from "react";

import {
  exportMyTeam,
  importMyTeam,
  saveMyTeam,
} from "@/lib/planner/useMyTeam";
import type { MyTeam } from "@/lib/planner/types";
import { saveWatchlist } from "@/lib/watchlist/useWatchlist";
import { WATCHLIST_VERSION } from "@/lib/watchlist/watchlist";

/** Export / import the saved team as a JSON file, and clear it. */
export default function TeamFileControls({ team }: { team: MyTeam | null }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleImport(file: File | undefined) {
    if (!file) {
      return;
    }

    const result = await importMyTeam(file);

    if (typeof result === "string") {
      setMessage(result);
      return;
    }

    const { team: imported, watchlist } = result;

    if (
      team &&
      !window.confirm(
        watchlist
          ? "Replace your saved team (and its plans) and watchlist with this file?"
          : "Replace your saved team (and its plans) with this file?",
      )
    ) {
      return;
    }

    saveMyTeam(imported);
    // Older files have no watchlist: the current one is kept.
    if (watchlist) {
      saveWatchlist({ version: WATCHLIST_VERSION, season: imported.season, players: watchlist });
    }
    setMessage(
      `Imported a team of ${imported.players.length} players${
        watchlist ? ` and a watchlist of ${watchlist.length}` : ""
      }.`,
    );
  }

  const button =
    "rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={button}
        disabled={!team}
        onClick={() => team && exportMyTeam(team)}
      >
        Export team
      </button>

      <button
        type="button"
        className={button}
        onClick={() => fileInput.current?.click()}
      >
        Import team
      </button>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Import a team file"
        onChange={(event) => {
          handleImport(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {team && (
        <button
          type="button"
          className={`${button} text-red-300`}
          onClick={() => {
            if (window.confirm("Delete your saved team and all its plans from this browser?")) {
              saveMyTeam(null);
            }
          }}
        >
          Clear team
        </button>
      )}

      {message && (
        <p role="status" className="w-full text-xs text-slate-400">
          {message}
        </p>
      )}
    </div>
  );
}
