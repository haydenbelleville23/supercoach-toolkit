"use client";

import { useState } from "react";

import type { Game } from "@/lib/games/types";

import GameTeamTable, { type GameTableView } from "./GameTeamTable";

/** Both teams' tables with one Stats | Price switch above them. */
export default function GameTables({ game, showTog }: { game: Game; showTog: boolean }) {
  const [view, setView] = useState<GameTableView>("stats");

  return (
    <>
      <div role="group" aria-label="Table view" className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
        {(["stats", "price"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view === option}
            onClick={() => setView(option)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              view === option ? "bg-violet-500 text-white" : "text-slate-300 hover:text-white"
            }`}
          >
            {option === "stats" ? "Stats" : "Price"}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-8">
        <GameTeamTable teamName={game.home.teamName} team={game.home.team} players={game.players.home} showTog={showTog} view={view} />
        <GameTeamTable teamName={game.away.teamName} team={game.away.team} players={game.players.away} showTog={showTog} view={view} />
      </div>
    </>
  );
}
