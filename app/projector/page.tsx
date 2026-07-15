"use client";

import Link from "next/link";
import { useState } from "react";

import PlayerHeader from "@/components/projector/PlayerHeader";
import PlayerSelector from "@/components/projector/PlayerSelector";
import PlayerStats from "@/components/projector/PlayerStats";
import ProjectionModeSelector from "@/components/projector/ProjectionModeSelector";
import SeasonProjectionTable from "@/components/projector/SeasonProjectionTable";

import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { getTeamFixture } from "@/lib/fixtures";
import { createPlayerState } from "@/lib/priceEngine/createPlayerState";
import { createSeasonRows } from "@/lib/priceEngine/createSeasonRows";
import { projectSeason } from "@/lib/priceEngine/projectSeason";
import { playerRepository } from "@/lib/repository/PlayerRepository";

import type { Player } from "@/types/player";
import type { SeasonProjectionRow } from "@/types/projection";

const players = playerRepository.getAll();

type ProjectionMode =
  | "api"
  | "season-average"
  | "three-round-average"
  | "five-round-average"
  | "custom";

function getProjectedScore({
  player,
  projectionIndex,
  mode,
  existingScore,
}: {
  player: Player;
  projectionIndex: number;
  mode: ProjectionMode;
  existingScore?: number | null;
}): number {
  switch (mode) {
    case "api":
      return (
        player.projectedScores[projectionIndex] ??
        Math.round(player.average)
      );

    case "season-average":
      return Math.round(player.average);

    case "three-round-average":
      return Math.round(player.average3);

    case "five-round-average":
      return Math.round(player.average5);

    case "custom":
      return (
        existingScore ??
        player.projectedScores[projectionIndex] ??
        Math.round(player.average)
      );
  }
}

function createRowsForPlayer(
  player: Player,
  mode: ProjectionMode = "api",
  existingRows?: SeasonProjectionRow[],
): SeasonProjectionRow[] {
  const rows = createSeasonRows();

  return rows.map((row) => {
    const teamFixture = getTeamFixture(
      player.team,
      row.round,
    );

    const historicalRow = player.history.find(
      (item) => item.round === row.round,
    );

    if (row.round <= CURRENT_COMPLETED_ROUND) {
      if (!historicalRow) {
        return {
          ...row,
          opponent: teamFixture?.opponent ?? null,
          homeAway: teamFixture?.homeAway ?? null,
        };
      }

      return {
        ...row,
        played: historicalRow.games > 0,
        isActual: true,
        score: historicalRow.score,

        price:
          row.round === CURRENT_COMPLETED_ROUND
            ? player.price
            : historicalRow.price,

        priceChange:
          row.round === CURRENT_COMPLETED_ROUND
            ? null
            : historicalRow.priceChange,

        breakEven:
          row.round === CURRENT_COMPLETED_ROUND
            ? player.breakeven
            : null,

        opponent:
          teamFixture?.opponent ??
          historicalRow.opponent,

        homeAway:
          teamFixture?.homeAway ??
          historicalRow.homeAway,
      };
    }

    const projectionIndex =
      row.round - CURRENT_COMPLETED_ROUND - 1;

    const existingScore = existingRows?.find(
      (existingRow) =>
        existingRow.round === row.round,
    )?.score;

    const suggestedScore = getProjectedScore({
      player,
      projectionIndex,
      mode,
      existingScore,
    });

    return {
      ...row,
      played: true,
      isActual: false,
      score: suggestedScore,
      opponent: teamFixture?.opponent ?? null,
      homeAway: teamFixture?.homeAway ?? null,
    };
  });
}

export default function ProjectorPage() {
  const [selectedPlayerId, setSelectedPlayerId] =
    useState(players[0].id);

  const [projectionMode, setProjectionMode] =
    useState<ProjectionMode>("api");

  const selectedPlayer =
    playerRepository.getById(selectedPlayerId) ??
    players[0];

  const [seasonRows, setSeasonRows] = useState<
    SeasonProjectionRow[]
  >(() =>
    calculateRowsForPlayer(
      createRowsForPlayer(players[0], "api"),
      players[0],
    ),
  );

  function calculateRowsForPlayer(
    rowsToCalculate: SeasonProjectionRow[],
    player: Player,
  ): SeasonProjectionRow[] {
    const state = createPlayerState(player);

    const futureRows = rowsToCalculate.filter(
      (row) =>
        row.round > CURRENT_COMPLETED_ROUND,
    );

    const projectedScores = futureRows.map(
      (row) =>
        row.score ?? Math.round(player.average),
    );

    const projections = projectSeason(
      state,
      projectedScores,
    );

    let projectionIndex = 0;

    return rowsToCalculate.map((row) => {
      if (row.round < CURRENT_COMPLETED_ROUND) {
        return row;
      }

      if (
        row.round === CURRENT_COMPLETED_ROUND
      ) {
        return {
          ...row,
          price: player.price,
          priceChange: null,
        };
      }

      if (!row.played || row.score === null) {
        return {
          ...row,
          breakEven: null,
          price: null,
          priceChange: null,
          threeRoundAverage: null,
        };
      }

      const projection =
        projections[projectionIndex++];

      if (!projection) {
        return row;
      }

      return {
        ...row,
        breakEven: projection.breakEven,
        price: projection.price,
        priceChange: projection.priceChange,
        threeRoundAverage:
          projection.threeRoundAverage,
        magicNumber: projection.magicNumber,
      };
    });
  }

  function handlePlayerChange(playerId: number) {
    const player =
      playerRepository.getById(playerId) ??
      players[0];

    const newRows = createRowsForPlayer(
      player,
      projectionMode,
    );

    setSelectedPlayerId(player.id);
    setSeasonRows(
      calculateRowsForPlayer(newRows, player),
    );
  }

  function handleProjectionModeChange(
    mode: ProjectionMode,
  ) {
    setProjectionMode(mode);

    setSeasonRows((currentRows) => {
      const rebuiltRows = createRowsForPlayer(
        selectedPlayer,
        mode,
        currentRows,
      );

      return calculateRowsForPlayer(
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

      return calculateRowsForPlayer(
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