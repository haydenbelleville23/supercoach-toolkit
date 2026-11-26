"use client";

import Link from "next/link";
import { useState } from "react";

import PlayerHeader from "@/components/projector/PlayerHeader";
import PlayerSelector from "@/components/projector/PlayerSelector";
import PlayerStats from "@/components/projector/PlayerStats";
import { getPlayerById, getPlayers } from "@/lib/players";
import { projectNextRoundPrice } from "@/lib/projector/projectNextRoundPrice";

const players = getPlayers();

function formatMoney(value: number): string {
  return `$${value.toLocaleString()}`;
}

function formatDifference(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";

  return `${sign}$${Math.abs(value).toLocaleString()}`;
}

export default function EnginePage() {
  const [selectedPlayerId, setSelectedPlayerId] = useState(
    players[0].id,
  );

  const selectedPlayer =
    getPlayerById(selectedPlayerId) ?? players[0];

  const [projectedScore, setProjectedScore] = useState(
    Math.round(selectedPlayer.average),
  );

  const engineResult = projectNextRoundPrice(
    selectedPlayer,
    projectedScore,
  );

  const previousScores =
    engineResult?.previousScores ??
    selectedPlayer.recentScores.slice(-2);

  function handlePlayerChange(playerId: number) {
    const player = getPlayerById(playerId) ?? players[0];

    setSelectedPlayerId(player.id);
    setProjectedScore(Math.round(player.average));
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xl font-bold">
              Footynomics
            </p>

            <p className="text-sm text-slate-400">
              Engine validation
            </p>
          </div>

          <div className="flex items-center gap-5 text-sm">
            <Link
              href="/projector"
              className="text-slate-300 hover:text-white"
            >
              Price Projector
            </Link>

            <Link
              href="/"
              className="text-emerald-400 hover:text-emerald-300"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Development tool
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Price Engine
          </h1>

          <p className="mt-4 text-slate-300">
            Inspect the inputs and outputs for a player&apos;s
            next projected round.
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

          <div className="mt-6">
            <PlayerSelector
              players={players}
              selectedPlayerId={selectedPlayerId}
              onChange={handlePlayerChange}
            />
          </div>

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
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
  <label
    htmlFor="engine-score"
    className="block text-sm font-semibold text-slate-300"
  >
    Test projected score
  </label>

  <input
    id="engine-score"
    type="number"
    min={0}
    max={250}
    step={1}
    inputMode="numeric"
    value={projectedScore}
    onFocus={(event) =>
      event.currentTarget.select()
    }
    onChange={(event) => {
      const value = event.target.value.replace(
        /[^0-9]/g,
        "",
      );

      setProjectedScore(
        value === "" ? 0 : Number(value),
      );
    }}
    className="mt-2 w-28 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-right font-semibold tabular-nums outline-none focus:border-emerald-500"
  />

  <p className="mt-2 text-xs text-slate-500">
    Prefilled from the player projection and editable for testing.
  </p>
</section>
        {previousScores.length < 2 || !engineResult ? (
          <section className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
            <h2 className="font-semibold text-amber-300">
              Not enough score history
            </h2>

            <p className="mt-2 text-sm text-amber-100/70">
              This player needs at least two recent scores before
              the engine can calculate their next price.
            </p>
          </section>
        ) : (
          <>
            <div className="mt-8 grid gap-6">
              <ComparisonCard
                title="Engine result"
                values={[
                  {
                    label: "Current price",
                    value: formatMoney(selectedPlayer.price),
                  },
                  {
                    label: "Projected score",
                    value: projectedScore.toString(),
                  },
                  {
                    label: "Break-even",
                    value:
                      engineResult.breakEven?.toString() ?? "-",
                  },
                  {
                    label: "Projected price",
                    value: formatMoney(engineResult.price),
                  },
                ]}
              />
            </div>

            <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">
                Calculation inputs
              </h2>

              <div className="mt-5 grid gap-x-10 gap-y-3 sm:grid-cols-2">
                <CalculationRow
                  label="Previous score 1"
                  value={previousScores[0].toString()}
                />

                <CalculationRow
                  label="Previous score 2"
                  value={previousScores[1].toString()}
                />

                <CalculationRow
                  label="Projected score"
                  value={projectedScore.toString()}
                />

                <CalculationRow
                  label="Three-round average"
                  value={engineResult.threeRoundAverage.toFixed(2)}
                />

                <CalculationRow
                  label="Scale factor k"
                  value={engineResult.k.toFixed(5)}
                />

                <CalculationRow
                  label="Price change"
                  value={formatDifference(
                    engineResult.priceChange,
                  )}
                />
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">
                Price calculation
              </h2>

              <div className="mt-5 overflow-x-auto rounded-xl bg-slate-950 p-5 font-mono text-sm text-slate-300">
                <p>
                  0.75 × {selectedPlayer.price.toLocaleString()} +
                  {" "}
                  0.25 × {engineResult.baseMagicNumber} ×
                  {" "}
                  {engineResult.threeRoundAverage.toFixed(2)}
                </p>

                <p className="mt-3 text-slate-500">
                  Raw price (before k = {engineResult.k.toFixed(5)})
                </p>

                <p className="mt-1 text-lg font-semibold text-white">
                {formatMoney(Math.round(engineResult.rawPrice))}
                </p>

                <p className="mt-4 text-slate-500">
                  Rounded price
                </p>

                <p className="mt-1 text-2xl font-bold text-emerald-400">
                  {formatMoney(engineResult.price)}
                </p>
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

type ComparisonValue = {
  label: string;
  value: string;
};

function ComparisonCard({
  title,
  values,
}: {
  title: string;
  values: ComparisonValue[];
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>

      <div className="mt-5 space-y-3">
        {values.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-5 border-b border-slate-800 pb-3 last:border-0 last:pb-0"
          >
            <span className="text-sm text-slate-400">
              {item.label}
            </span>

            <span className="font-semibold tabular-nums">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CalculationRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 py-2">
      <span className="text-sm text-slate-400">
        {label}
      </span>

      <span className="font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}
