"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import PlayerHeader from "@/components/projector/PlayerHeader";
import PlayerSelector from "@/components/projector/PlayerSelector";
import PlayerStats from "@/components/projector/PlayerStats";
import ProjectionModeSelector from "@/components/projector/ProjectionModeSelector";
import SeasonProjectionTable from "@/components/projector/SeasonProjectionTable";
import { buildPlayerRows } from "@/lib/projector/buildPlayerRows";
import { calculateScaledProjectionRows as calculateProjectionRows } from "@/lib/projector/calculateScaledProjectionRows";
import { playerRepository } from "@/lib/repository/PlayerRepository";

import type { ProjectionMode } from "@/lib/projector/projectionModes";
import type { SeasonProjectionRow } from "@/types/projection";

const players = playerRepository.getAll();

/**
 * Opens the player named in ?player=ID (links from Cash Cows and Live
 * Scores), falling back to the first player. Keyed on the id so following
 * a link to another player starts fresh.
 */
export default function ProjectorToolFromUrl() {
  const requestedId = Number(useSearchParams().get("player"));

  const initialPlayerId =
    playerRepository.getById(requestedId)?.id ?? players[0].id;

  return (
    <ProjectorTool
      key={initialPlayerId}
      initialPlayerId={initialPlayerId}
    />
  );
}

function ProjectorTool({
  initialPlayerId,
}: {
  initialPlayerId: number;
}) {
  const [selectedPlayerId, setSelectedPlayerId] =
    useState(initialPlayerId);

  const [projectionMode, setProjectionMode] =
    useState<ProjectionMode>("projected");

  const selectedPlayer =
    playerRepository.getById(selectedPlayerId) ??
    players[0];

  const [seasonRows, setSeasonRows] = useState<
    SeasonProjectionRow[]
  >(() =>
    calculateProjectionRows(
      buildPlayerRows(selectedPlayer, "projected"),
      selectedPlayer,
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
    <>
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
    </>
  );
}
