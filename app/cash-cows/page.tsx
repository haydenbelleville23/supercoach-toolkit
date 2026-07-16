"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  calculateCashCowRows,
} from "@/lib/cashcows";
import type {
  CashCowScoreOverrides,
} from "@/lib/cashcows";
import {
  CURRENT_COMPLETED_ROUND,
  FINAL_ROUND,
} from "@/data/season";

import type { ProjectionMode } from "@/lib/projector";
import { playerRepository } from "@/lib/repository/PlayerRepository";

type SortMode =
  | "peak-gain"
  | "rise-1"
  | "rise-3"
  | "rise-5";

const players = playerRepository.getAll();
const futureRounds = Array.from(
  {
    length:
      FINAL_ROUND -
      CURRENT_COMPLETED_ROUND,
  },
  (_, index) =>
    CURRENT_COMPLETED_ROUND +
    index +
    1,
);

function formatMoney(value: number): string {
  return `$${value.toLocaleString()}`;
}

function formatGain(value: number | null): string {
  if (value === null || value === 0) {
    return "-";
  }

  const sign = value > 0 ? "+" : "−";

  return `${sign}${Math.abs(value).toLocaleString()}`;
}

function getGainColour(
  value: number | null,
): string {
  if (value === null || value === 0) {
    return "text-slate-500";
  }

  if (value < 0) {
    return "text-red-400";
  }

  if (value < 10_000) {
    return "text-slate-300";
  }

  if (value < 20_000) {
    return "text-blue-400";
  }

  if (value < 30_000) {
    return "text-emerald-400";
  }

  return "text-amber-400";
}

function getSortValue(
  sortMode: SortMode,
  row: ReturnType<
    typeof calculateCashCowRows
  >[number],
): number {
  switch (sortMode) {
    case "peak-gain":
      return row.toppedOutGain;

    case "rise-1":
      return row.rise1 ?? Number.NEGATIVE_INFINITY;

    case "rise-3":
      return row.rise3 ?? Number.NEGATIVE_INFINITY;

    case "rise-5":
      return row.rise5 ?? Number.NEGATIVE_INFINITY;
  }
}

export default function CashCowsPage() {
  const [projectionMode, setProjectionMode] =
    useState<ProjectionMode>("projected");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [sortMode, setSortMode] =
    useState<SortMode>("peak-gain");

  const [rowLimit, setRowLimit] =
    useState(100);

  const [scoreOverrides, setScoreOverrides] =
  useState<CashCowScoreOverrides>({});

  const visibleRows = useMemo(() => {
    const normalisedSearch =
      searchQuery.trim().toLowerCase();

        return calculateCashCowRows(
        players,
        projectionMode,
        scoreOverrides,
        )
      .filter((row) => {
        if (normalisedSearch === "") {
          return true;
        }

        return row.player.name
          .toLowerCase()
          .includes(normalisedSearch);
      })
      .sort(
        (a, b) =>
          getSortValue(sortMode, b) -
          getSortValue(sortMode, a),
      )
      .slice(0, rowLimit);
  }, [
    projectionMode,
    searchQuery,
    sortMode,
    rowLimit,
    scoreOverrides,
  ]);

  function updateProjectedScore(
  playerId: number,
  round: number,
  value: string,
) {
  const trimmedValue = value.trim();

  setScoreOverrides((current) => {
    const playerOverrides = {
      ...(current[playerId] ?? {}),
    };

    if (trimmedValue === "") {
      delete playerOverrides[round];

      if (
        Object.keys(playerOverrides).length === 0
      ) {
        const updated = { ...current };
        delete updated[playerId];

        return updated;
      }

      return {
        ...current,
        [playerId]: playerOverrides,
      };
    }

    const parsedScore = Number(trimmedValue);

    if (
      !Number.isFinite(parsedScore) ||
      parsedScore < 0
    ) {
      return current;
    }

    return {
      ...current,
      [playerId]: {
        ...playerOverrides,
        [round]: Math.round(parsedScore),
      },
    };
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
              Cash Cows
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
            Cash Cow Finder
          </h1>

          <p className="mt-4 text-slate-300">
            Compare projected cash generation across
            the player pool.
          </p>
        </div>

        <section className="mt-8 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Projection
            </span>

            <select
              value={projectionMode}
              onChange={(event) =>
                setProjectionMode(
                  event.target.value as ProjectionMode,
                )
              }
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value="projected">
                Projected
              </option>

              <option value="season-average">
                Season Avg
              </option>

              <option value="three-round-average">
                3RA
              </option>

              <option value="five-round-average">
                5RA
              </option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search
            </span>

            <input
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="Search player..."
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sort
            </span>

            <select
              value={sortMode}
              onChange={(event) =>
                setSortMode(
                  event.target.value as SortMode,
                )
              }
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value="peak-gain">
                Topped Out Gain
              </option>

              <option value="rise-1">
                +1 Round
              </option>

              <option value="rise-3">
                +3 Rounds
              </option>

              <option value="rise-5">
                +5 Rounds
              </option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Rows
            </span>

            <select
              value={rowLimit}
              onChange={(event) =>
                setRowLimit(
                  Number(event.target.value),
                )
              }
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={1000}>
                All
              </option>
            </select>
          </label>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
           <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[1500px] text-sm">
              <thead className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="sticky left-0 z-30 bg-slate-950 px-4 py-3">
                    Player
                  </th>

                  <th className="px-3 py-3 text-right">
                    Price
                  </th>

                  <th className="px-3 py-3 text-right">
                    BE
                  </th>

                  <th className="px-3 py-3 text-right">
                    Proj Avg
                  </th>

                  <th className="px-3 py-3 text-right">
                    Topped Out Gain
                  </th>

                  <th className="px-3 py-3 text-right">
                    Topped Out Rd
                  </th>

                  <th className="px-3 py-3 text-right">
                    +1R
                  </th>

                  <th className="px-3 py-3 text-right">
                    +3R
                  </th>

                  <th className="px-3 py-3 text-right">
                    +5R
                  </th>
                  {futureRounds.map((round) => (
                    <th
                        key={round}
                        className="min-w-[112px] px-3 py-3 text-right"
                    >
                        R{round}
                    </th>
                    ))}
                </tr>
              </thead>

              <tbody>
                {visibleRows.map((row) => (
                  <tr
                    key={row.player.id}
                    className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40"
                  >
                    <td className="sticky left-0 z-10 bg-slate-900 px-4 py-3">
                      <Link
                        href={`/projector?player=${row.player.id}`}
                        className="font-semibold text-white hover:text-emerald-400"
                      >
                        {row.player.name}
                      </Link>

                      <div className="mt-0.5 text-xs text-slate-500">
                        {row.player.team} ·{" "}
                        {row.player.positions.join(
                          "/",
                        )}
                      </div>
                    </td>

                    <td className="sticky left-0 z-10 bg-slate-900 px-4 py-3">
                      {formatMoney(
                        row.player.price,
                      )}
                    </td>

                    <td className="sticky left-0 z-10 bg-slate-900 px-4 py-3">
                      {row.player.breakeven}
                    </td>

                    <td className="sticky left-0 z-10 bg-slate-900 px-4 py-3">
                      {row.projectedAverage}
                    </td>

                    <td
                      className={`px-3 py-3 text-right font-semibold tabular-nums ${getGainColour(
                        row.toppedOutGain,
                      )}`}
                    >
                      {formatGain(row.toppedOutGain)}
                    </td>

                    <td className="px-3 py-3 text-right tabular-nums text-slate-300">
                      {row.toppedOutRound === null
                        ? "-"
                        : `R${row.toppedOutRound}`}
                    </td>

                    <td
                      className={`px-3 py-3 text-right font-semibold tabular-nums ${getGainColour(
                        row.rise1,
                      )}`}
                    >
                      {formatGain(row.rise1)}
                    </td>

                    <td
                      className={`px-3 py-3 text-right font-semibold tabular-nums ${getGainColour(
                        row.rise3,
                      )}`}
                    >
                      {formatGain(row.rise3)}
                    </td>

                    <td
                      className={`px-3 py-3 text-right font-semibold tabular-nums ${getGainColour(
                        row.rise5,
                      )}`}
                    >
                      {formatGain(row.rise5)}
                    </td>
                    {futureRounds.map((round) => {
  const projectedRound =
    row.projectedRounds.find(
      (item) => item.round === round,
    );

  const overriddenScore =
    scoreOverrides[row.player.id]?.[
      round
    ];

    if (!projectedRound) {
        return (
        <td
            key={round}
            className="px-3 py-3 text-right text-slate-500"
        >
            -
        </td>
        );
    }

    return (
        <td
        key={round}
        className="px-3 py-3 text-right"
        >
        <div className="font-semibold tabular-nums text-slate-100">
            {formatMoney(
            projectedRound.price,
            )}
        </div>

        <input
            type="text"
            inputMode="numeric"
            value={
            overriddenScore ??
            projectedRound.score
            }
            onChange={(event) =>
            updateProjectedScore(
                row.player.id,
                round,
                event.target.value,
            )
            }
            onFocus={(event) =>
            event.currentTarget.select()
            }
            className={`mt-1 w-10 rounded border px-2 py-1 text-right text-xs tabular-nums outline-none ${
            overriddenScore !== undefined
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                : "border-slate-700 bg-slate-950 text-slate-400"
            }`}
                    />
                    </td>
                );
                })}
                  </tr>
                ))}

                {visibleRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9 + futureRounds.length}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      No matching players with enough
                      score history.
                    </td>
                  </tr>
                )}
               </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm font-semibold text-slate-200">
            Price Rise Guide
          </p>

          <div className="mt-3 flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-bold text-red-400">
                ●
              </span>

              <span className="text-slate-300">
                &lt; $10k
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-400">
                ●
              </span>

              <span className="text-slate-300">
                $10k–$19.9k
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-400">
                ●
              </span>

              <span className="text-slate-300">
                $20k–$29.9k
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-400">
                ●
              </span>

              <span className="text-slate-300">
                $30k+
              </span>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Edit any projected score to instantly
            recalculate future prices, break evens and
            projected cash generation for that player.
          </p>
        </section>
      </section>
    </main>
  );
}