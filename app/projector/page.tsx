"use client";

import Link from "next/link";
import { useState } from "react";

import PlayerSelector from "@/components/projector/PlayerSelector";
import PlayerStats from "@/components/projector/PlayerStats";
import ProjectionTable from "@/components/projector/ProjectionTable";
import ScoreInputs from "@/components/projector/ScoreInputs";
import { getPlayerById, getPlayers } from "@/lib/players";
import { projectPrice } from "@/lib/calculator";
const players = getPlayers();

type ProjectionResult = {
  round: number;
  score: number;
  price: number;
  change: number;
};

export default function ProjectorPage() {
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0].id);

  const [scores, setScores] = useState<number[]>([
    players[0].average,
    players[0].average,
    players[0].average,
  ]);

  const [results, setResults] = useState<ProjectionResult[]>([]);

  const selectedPlayer =
  getPlayerById(selectedPlayerId) ?? players[0];

  function handlePlayerChange(playerId: number) {
  const player = getPlayerById(playerId) ?? players[0];

    setSelectedPlayerId(player.id);
    setScores([player.average, player.average, player.average]);
    setResults([]);
  }

  function updateScore(index: number, value: number) {
    setScores((currentScores) =>
      currentScores.map((score, scoreIndex) =>
        scoreIndex === index ? value : score,
      ),
    );
  }

  function calculateProjection() {
    let currentPrice = selectedPlayer.price;

    const projections = scores.map((score, index) => {
      const previousPrice = currentPrice;

      currentPrice = projectPrice(
        currentPrice,
        selectedPlayer.breakeven,
        score,
      );

      return {
        round: index + 1,
        score,
        price: currentPrice,
        change: currentPrice - previousPrice,
      };
    });

    setResults(projections);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xl font-bold">SuperCoach Toolkit</p>
            <p className="text-sm text-slate-400">Price Projector</p>
          </div>

          <Link
            className="text-sm text-emerald-400 hover:text-emerald-300"
            href="/"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Prototype
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            AFL SuperCoach Price Projector
          </h1>

          <p className="mt-4 text-slate-300">
            Select a player and enter their expected scores for the next three
            rounds.
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
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

            <ScoreInputs
              scores={scores}
              onScoreChange={updateScore}
            />

            <button
              type="button"
              onClick={calculateProjection}
              className="mt-8 w-full rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Calculate projection
            </button>
          </section>

          <ProjectionTable results={results} />
        </div>
      </section>
    </main>
  );
}