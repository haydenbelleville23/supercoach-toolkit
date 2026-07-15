"use client";

import Link from "next/link";
import { useState } from "react";

import PlayerSelector from "@/components/projector/PlayerSelector";
import PlayerStats from "@/components/projector/PlayerStats";
import SeasonProjectionTable from "@/components/projector/SeasonProjectionTable";
import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { getPlayerById, getPlayers } from "@/lib/players";
import { calculateBreakEven } from "@/lib/priceEngine/calculateBreakEven";
import { calculatePrice } from "@/lib/priceEngine/calculatePrice";
import { createSeasonRows } from "@/lib/priceEngine/createSeasonRows";
import type { Player } from "@/types/player";
import type { SeasonProjectionRow } from "@/types/projection";

const players = getPlayers();

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

      const suggestedScore =
        player.projectedScores[projectionIndex] ??
        Math.round(player.average);

      return {
        ...row,
        played: true,
        score: suggestedScore,
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
    getPlayerById(selectedPlayerId) ?? players[0];

  const [seasonRows, setSeasonRows] = useState<SeasonProjectionRow[]>(
    () => createRowsForPlayer(players[0]),
  );

  function handlePlayerChange(playerId: number) {
    const player = getPlayerById(playerId) ?? players[0];

    setSelectedPlayerId(player.id);
    setSeasonRows(createRowsForPlayer(player));
  }

  function updateSeasonScore(
    round: number,
    score: number | null,
  ) {
    setSeasonRows((currentRows) =>
      currentRows.map((row) =>
        row.round === round ? { ...row, score } : row,
      ),
    );
  }

  function updatePlayedStatus(
    round: number,
    played: boolean,
  ) {
    setSeasonRows((currentRows) =>
      currentRows.map((row) =>
        row.round === round
          ? {
              ...row,
              played,
              score: played
                ? row.score ?? Math.round(selectedPlayer.average)
                : null,
              breakEven: null,
              price: null,
              priceChange: null,
              threeRoundAverage: null,
            }
          : row,
      ),
    );
  }

  function calculateFullSeason() {
    let currentPrice = selectedPlayer.price;

    const latestScores =
      selectedPlayer.recentScores.slice(-2);

    if (latestScores.length < 2) {
      alert(
        "Two previous scores are required to calculate future prices.",
      );
      return;
    }

    let rollingScores: [number, number] = [
      latestScores[0],
      latestScores[1],
    ];

    const calculatedRows = seasonRows.map((row) => {
      if (row.round < CURRENT_COMPLETED_ROUND) {
        return row;
      }

      if (row.round === CURRENT_COMPLETED_ROUND) {
        return {
          ...row,
          price: selectedPlayer.price,
        };
      }

      if (!row.played) {
        return {
          ...row,
          breakEven: null,
          price: currentPrice,
          priceChange: 0,
          threeRoundAverage: null,
        };
      }

      if (row.score === null) {
        return {
          ...row,
          breakEven: null,
          price: null,
          priceChange: null,
          threeRoundAverage: null,
        };
      }

      const breakEven = calculateBreakEven({
        currentPrice,
        previousScores: rollingScores,
        magicNumber: row.magicNumber,
      });

      const priceResult = calculatePrice({
        currentPrice,
        previousScores: rollingScores,
        projectedScore: row.score,
        magicNumber: row.magicNumber,
      });

      const calculatedRow: SeasonProjectionRow = {
        ...row,
        breakEven,
        price: priceResult.projectedPrice,
        priceChange: priceResult.priceChange,
        threeRoundAverage:
          priceResult.threeRoundAverage,
      };

      currentPrice = priceResult.projectedPrice;
      rollingScores = [rollingScores[1], row.score];

      return calculatedRow;
    });

    setSeasonRows(calculatedRows);
  }

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
          <PlayerSelector
            players={players}
            selectedPlayerId={selectedPlayerId}
            onChange={handlePlayerChange}
          />

          <PlayerStats
            price={selectedPlayer.price}
            average={selectedPlayer.average}
            breakeven={selectedPlayer.breakeven}
          />

          <div className="mt-6 flex flex-wrap items-end justify-between gap-5 border-t border-slate-800 pt-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Projected final price
                </p>
                <p className="mt-1 text-2xl font-bold">
                  ${finalProjectedPrice.toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Projected change
                </p>
                <p
                  className={`mt-1 text-2xl font-bold ${
                    totalPriceChange >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {totalPriceChange >= 0 ? "+" : "−"}$
                  {Math.abs(
                    totalPriceChange,
                  ).toLocaleString()}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={calculateFullSeason}
              className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Calculate full season
            </button>
          </div>
        </section>

        <div className="mt-8">
          <SeasonProjectionTable
            rows={seasonRows}
            onScoreChange={updateSeasonScore}
            onPlayedChange={updatePlayedStatus}
          />
        </div>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          Magic Numbers are controlled by the Toolkit’s
          season model and cannot be edited. Future values
          may be estimates until confirmed using actual
          weekly price movements.
        </p>
      </section>
    </main>
  );
}