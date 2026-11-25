"use client";

import { useRef, useState } from "react";

import {
  exportMyTeam,
  importMyTeam,
  saveMyTeam,
} from "@/lib/planner/useMyTeam";
import type { MyTeam } from "@/lib/planner/types";

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

    if (
      team &&
      !window.confirm("Replace your saved team (and its plans) with this file?")
    ) {
      return;
    }

    saveMyTeam(result);
    setMessage(`Imported a team of ${result.players.length} players.`);
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
