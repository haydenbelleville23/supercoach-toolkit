"use client";

import Link from "next/link";
import { useState } from "react";

import PlayerHeader from "@/components/projector/PlayerHeader";
import PlayerSelector from "@/components/projector/PlayerSelector";
import PlayerStats from "@/components/projector/PlayerStats";
import ProjectionModeSelector from "@/components/projector/ProjectionModeSelector";
import SeasonProjectionTable from "@/components/projector/SeasonProjectionTable";
import { getProjectedScore } from "@/lib/projector/getProjectedScore";
import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { getTeamFixture } from "@/lib/fixtures";
import { createSeasonRows } from "@/lib/priceEngine/createSeasonRows";
import { playerRepository } from "@/lib/repository/PlayerRepository";
import { buildPlayerRows } from "@/lib/projector/buildPlayerRows";
import { calculateProjectionRows } from "@/lib/projector/calculateProjectionRows";

import type { ProjectionMode } from "@/lib/projector/projectionModes";
import type { Player } from "@/types/player";
import type { SeasonProjectionRow } from "@/types/projection";

const players = playerRepository.getAll();
console.log(
  "Projector Players Count:",
  players.length);

export default function ProjectorPage() {
  const [selectedPlayerId, setSelectedPlayerId] =
    useState(players[0].id);

  const [projectionMode, setProjectionMode] =
    useState<ProjectionMode>("projected");

  const selectedPlayer =
    playerRepository.getById(selectedPlayerId) ??
    players[0];

  const [seasonRows, setSeasonRows] = useState<
    SeasonProjectionRow[]
  >(() =>
    calculateProjectionRows(
      buildPlayerRows(players[0], "projected"),
      players[0],
    ),
  );

 
  function handlePlayerChange(playerId: number) {
    const player =
      playerRepository.getById(playerId) ??
      players[0];

    const newRows = buildPlayerRows(
      player,
      projectionMode,
    );

    setSelectedPlayerId(player.id);
    setSeasonRows(
      calculateProjectionRows(newRows, player),
    );
  }

  function handleProjectionModeChange(
    mode: ProjectionMode,
  ) {
    setProjectionMode(mode);

    setSeasonRows((currentRows) => {
      const rebuiltRows = buildPlayerRows(
        selectedPlayer,
        mode,
        currentRows,
      );

      return calculateProjectionRows(
        rebuiltRows,
        selectedPlayer,
      );
    });
  }

  function updateSeasonScore(
    round: number,
    score: number | null,
  ) {
    setProjectionMode("custom");

    setSeasonRows((currentRows) => {
      const updatedRows = currentRows.map((row) =>
        row.round === round
          ? {
              ...row,
              score,
            }
          : row,
      );

      return calculateProjectionRows(
        updatedRows,
        selectedPlayer,
      );
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xl font-bold">
              SuperCoach Toolkit
            </p>

            <p className="text-sm text-slate-400">
              Price Projector
            </p>
          </div>

          <Link
            href="/"
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            2026 season
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            AFL SuperCoach Price Projector
          </h1>

          <p className="mt-4 text-slate-300">
            Enter projected scores for the remaining
            rounds. Prices use a rolling three-game
            average and the weekly Magic Number.
          </p>
        </div>

        <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <PlayerHeader
            name={selectedPlayer.name}
            team={selectedPlayer.team}
            teamName={selectedPlayer.teamName}
            positions={selectedPlayer.positions}
            availability={
              selectedPlayer.availability
            }
          />

          <PlayerSelector
            players={players}
            selectedPlayerId={selectedPlayerId}
            onChange={handlePlayerChange}
          />

          <PlayerStats
            price={selectedPlayer.price}
            breakeven={selectedPlayer.breakeven}
            games={selectedPlayer.games}
            average={selectedPlayer.average}
            average3={selectedPlayer.average3}
            average5={selectedPlayer.average5}
            ownership={selectedPlayer.ownership}
          />
        </section>

        <div className="mt-8">
          <ProjectionModeSelector
            value={projectionMode}
            onChange={
              handleProjectionModeChange
            }
          />
        </div>

        <div className="mt-4">
          <SeasonProjectionTable
            rows={seasonRows}
            startingPrice={selectedPlayer.price}
            onScoreChange={updateSeasonScore}
          />
        </div>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          Magic Numbers are controlled by the
          Toolkit&apos;s season model and cannot be
          edited. Future values may be estimates until
          confirmed using actual weekly price
          movements.
        </p>
      </section>
    </main>
  );
}