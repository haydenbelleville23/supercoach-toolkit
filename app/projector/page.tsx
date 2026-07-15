"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import PlayerSelector from "@/components/projector/PlayerSelector";
import PlayerStats from "@/components/projector/PlayerStats";
import SeasonProjectionTable from "@/components/projector/SeasonProjectionTable";
import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { getPlayerById, getPlayers } from "@/lib/players";
import { createSeasonRows } from "@/lib/priceEngine/createSeasonRows";
import type { Player } from "@/types/player";
import type { SeasonProjectionRow } from "@/types/projection";
import PlayerHeader from "@/components/projector/PlayerHeader";
import { createPlayerState } from "@/lib/priceEngine/createPlayerState";
import { projectSeason } from "@/lib/priceEngine/projectSeason";

import { playerRepository } from "@/lib/repository/PlayerRepository";
const players = playerRepository.getAll();

function createRowsForPlayer(player: Player): SeasonProjectionRow[] {
  const rows = createSeasonRows();
  const latestScore = player.recentScores.at(-1) ?? null;

  return rows.map((row) => {
    if (row.round === CURRENT_COMPLETED_ROUND) {
      return {
        ...row,
        played: latestScore !== null,
        isActual: true,
        score: latestScore,
        price: player.price,
        priceChange: null,
      };
    }

    if (row.round > CURRENT_COMPLETED_ROUND) {
      const projectionIndex =
        row.round - CURRENT_COMPLETED_ROUND - 1;

      const fixture = player.upcomingFixtures.find(
        (item) => item.round === row.round,
      );

      const suggestedScore =
        player.projectedScores[projectionIndex] ??
        Math.round(player.average);

      return {
        ...row,
        played: true,
        score: suggestedScore,
        opponent: fixture?.opponent ?? null,
        homeAway: fixture?.homeAway ?? null,
      };
    }

    return row;
  });
}

export default function ProjectorPage() {
  const [selectedPlayerId, setSelectedPlayerId] = useState(
    players[0].id,
  );

  const selectedPlayer =
    playerRepository.getById(selectedPlayerId) ?? players[0];

  const [seasonRows, setSeasonRows] = useState<
    SeasonProjectionRow[]
  >(() => createRowsForPlayer(players[0]));

  function calculateRows(
  rowsToCalculate: SeasonProjectionRow[],
  player: Player = selectedPlayer,
): SeasonProjectionRow[] {
  const state = createPlayerState(player);

  const futureRows = rowsToCalculate.filter(
    (row) => row.round > CURRENT_COMPLETED_ROUND,
  );

  const projectedScores = futureRows.map(
    (row) => row.score ?? Math.round(player.average),
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

    if (row.round === CURRENT_COMPLETED_ROUND) {
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

    const projection = projections[projectionIndex++];

    return {
      ...row,
      breakEven: projection.breakEven,
      price: projection.price,
      priceChange: projection.priceChange,
      threeRoundAverage: projection.threeRoundAverage,
      magicNumber: projection.magicNumber,
    };
  });
}

  function handlePlayerChange(playerId: number) {
    const player = getPlayerById(playerId) ?? players[0];
    const newRows = createRowsForPlayer(player);

    setSelectedPlayerId(player.id);
    setSeasonRows(calculateRows(newRows, player));
  }

  function updateSeasonScore(
    round: number,
    score: number | null,
  ) {
    setSeasonRows((currentRows) => {
      const updatedRows = currentRows.map((row) =>
        row.round === round
          ? {
              ...row,
              score,
            }
          : row,
      );

      return calculateRows(updatedRows);
    });
  }

  useEffect(() => {
    setSeasonRows((currentRows) =>
      calculateRows(currentRows),
    );
    // Recalculate when the selected player changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayerId]);

  const finalProjectedRow = [...seasonRows]
    .reverse()
    .find((row) => row.price !== null);

  const finalProjectedPrice =
    finalProjectedRow?.price ?? selectedPlayer.price;

  const totalPriceChange =
    finalProjectedPrice - selectedPlayer.price;

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
            className="text-sm text-emerald-400 hover:text-emerald-300"
            href="/"
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
            Enter projected scores for the remaining rounds.
            Prices use a rolling three-game average and the
            weekly Magic Number.
          </p>
        </div>

        <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <PlayerHeader
            name={selectedPlayer.name}
            team={selectedPlayer.team}
            teamName={selectedPlayer.teamName}
            positions={selectedPlayer.positions}
            availability={selectedPlayer.availability}
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
          <SeasonProjectionTable
                rows={seasonRows}
                startingPrice={selectedPlayer.price}
                onScoreChange={updateSeasonScore}
            />
        </div>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          Magic Numbers are controlled by the Toolkit&apos;s
          season model and cannot be edited. Future values may
          be estimates until confirmed using actual weekly price
          movements.
        </p>
      </section>
    </main>
  );
}