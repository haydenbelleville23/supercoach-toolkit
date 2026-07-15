"use client";

import Link from "next/link";
import { useState } from "react";

import players from "@/data/players.json";
import { projectPrice } from "@/lib/calculator";

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
    players.find((player) => player.id === selectedPlayerId) ?? players[0];

  function handlePlayerChange(playerId: number) {
    const player =
      players.find((item) => item.id === playerId) ?? players[0];

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

          <Link className="text-sm text-emerald-400 hover:text-emerald-300" href="/">
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
            <label
              className="block text-sm font-semibold text-slate-300"
              htmlFor="player"
            >
              Player
            </label>

            <select
              id="player"
              value={selectedPlayerId}
              onChange={(event) =>
                handlePlayerChange(Number(event.target.value))
              }
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
            >
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} — {player.team}
                </option>
              ))}
            </select>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <PlayerStat
                label="Price"
                value={`$${selectedPlayer.price.toLocaleString()}`}
              />
              <PlayerStat
                label="Average"
                value={selectedPlayer.average.toString()}
              />
              <PlayerStat
                label="Break-even"
                value={selectedPlayer.breakeven.toString()}
              />
            </div>

            <h2 className="mt-8 font-semibold">Projected scores</h2>

            <div className="mt-4 space-y-3">
              {scores.map((score, index) => (
                <label
                  className="flex items-center justify-between gap-4"
                  key={index}
                >
                  <span className="text-sm text-slate-300">
                    Next round +{index + 1}
                  </span>

                  <input
                    type="number"
                    min="0"
                    max="250"
                    value={score}
                    onChange={(event) =>
                      updateScore(index, Number(event.target.value))
                    }
                    className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-right"
                  />
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={calculateProjection}
              className="mt-8 w-full rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Calculate projection
            </button>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Projected prices</h2>

            {results.length === 0 ? (
              <div className="mt-8 rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                Enter the expected scores and calculate the projection.
              </div>
            ) : (
              <div className="mt-6 overflow-hidden rounded-xl border border-slate-800">
                <table className="w-full text-left">
                  <thead className="bg-slate-950 text-sm text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Round</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Change</th>
                      <th className="px-4 py-3 text-right">Price</th>
                    </tr>
                  </thead>

                  <tbody>
                    {results.map((result) => (
                      <tr
                        className="border-t border-slate-800"
                        key={result.round}
                      >
                        <td className="px-4 py-4">+{result.round}</td>
                        <td className="px-4 py-4">{result.score}</td>
                        <td
                          className={`px-4 py-4 ${
                            result.change >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {result.change >= 0 ? "+" : "-"}$
                          {Math.abs(result.change).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-right font-semibold">
                          ${result.price.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-5 text-xs leading-5 text-slate-500">
              Prototype estimates only. The pricing calculation will be refined
              after our SuperCoach data and pricing-model investigation.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

function PlayerStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-950 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}