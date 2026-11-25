"use client";

import Link from "next/link";
import DataFreshness from "@/components/layout/DataFreshness";
import Header from "@/components/layout/Header";
import {
  type UIEvent,
  useMemo,
  useState,
} from "react";

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
  | "rise-5"
  | "price-high"
  | "price-low"
  | "breakeven-low"
  | "breakeven-high";

type PositionFilter =
  | "ALL"
  | "DEF"
  | "MID"
  | "RUC"
  | "FWD";

type PriceFilter =
  | "all"
  | "rookies"
  | "mid-pricers"
  | "premiums";

const players = playerRepository.getAll();

const clubs = Array.from(
  new Set(players.map((player) => player.team)),
).sort((a, b) => a.localeCompare(b));

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
 if (value === null) {
  return "-";
}

  const sign = value > 0 ? "+" : "-";

  return `${sign}$${Math.abs(value).toLocaleString()}`;
}

function getGainColour(
  value: number | null,
): string {
  if (value === null) {
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
    return "text-amber-400";
  }

  return "text-emerald-400";
}

type CashCowRow = ReturnType<
  typeof calculateCashCowRows
>[number];

function compareRows(
  sortMode: SortMode,
  a: CashCowRow,
  b: CashCowRow,
): number {
  switch (sortMode) {
    case "peak-gain":
      return b.toppedOutGain - a.toppedOutGain;

    case "rise-1":
      return (
        (b.rise1 ?? Number.NEGATIVE_INFINITY) -
        (a.rise1 ?? Number.NEGATIVE_INFINITY)
      );

    case "rise-3":
      return (
        (b.rise3 ?? Number.NEGATIVE_INFINITY) -
        (a.rise3 ?? Number.NEGATIVE_INFINITY)
      );

    case "rise-5":
      return (
        (b.rise5 ?? Number.NEGATIVE_INFINITY) -
        (a.rise5 ?? Number.NEGATIVE_INFINITY)
      );

    case "price-high":
      return b.player.price - a.player.price;

    case "price-low":
      return a.player.price - b.player.price;

    case "breakeven-low":
      return (
        a.player.breakeven -
        b.player.breakeven
      );

    case "breakeven-high":
      return (
        b.player.breakeven -
        a.player.breakeven
      );
  }
}

export default function CashCowsPage() {
  const [projectionMode, setProjectionMode] =
    useState<ProjectionMode>("projected");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [sortMode, setSortMode] =
    useState<SortMode>("peak-gain");

  const [positionFilter, setPositionFilter] =
  useState<PositionFilter>("ALL");

  const [priceFilter, setPriceFilter] =
    useState<PriceFilter>("all");

  const [clubFilter, setClubFilter] =
    useState("ALL");

  const [visibleCount, setVisibleCount] =
    useState(50);

  const [scoreOverrides, setScoreOverrides] =
  useState<CashCowScoreOverrides>({});

  const filteredRows = useMemo(() => {
  const normalisedSearch =
    searchQuery.trim().toLowerCase();

  return calculateCashCowRows(
    players,
    projectionMode,
    scoreOverrides,
  )
    .filter((row) => {
      const matchesSearch =
        normalisedSearch === "" ||
        row.player.name
          .toLowerCase()
          .includes(normalisedSearch);

      const matchesPosition =
        positionFilter === "ALL" ||
        row.player.positions.includes(
          positionFilter,
        );

      const matchesClub =
        clubFilter === "ALL" ||
        row.player.team === clubFilter;

      const matchesPrice = (() => {
        switch (priceFilter) {
          case "rookies":
            return row.player.price < 300_000;

          case "mid-pricers":
            return (
              row.player.price >= 300_000 &&
              row.player.price <= 650_000
            );

          case "premiums":
            return row.player.price > 650_000;

          case "all":
            return true;
        }
      })();

      return (
        matchesSearch &&
        matchesPosition &&
        matchesClub &&
        matchesPrice
      );
    })
    .sort((a, b) =>
      compareRows(sortMode, a, b),
    );
}, [
  projectionMode,
  searchQuery,
  sortMode,
  scoreOverrides,
  positionFilter,
  priceFilter,
  clubFilter,
]);

const visibleRows = useMemo(
  () => filteredRows.slice(0, visibleCount),
  [filteredRows, visibleCount],
);

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

  // Show the first 50 rows again whenever a filter or sort changes
  // (adjusted during render rather than in an effect).
  const filterKey = [
    searchQuery,
    projectionMode,
    positionFilter,
    priceFilter,
    clubFilter,
    sortMode,
  ].join("|");

  const [visibleCountKey, setVisibleCountKey] =
    useState(filterKey);

  if (visibleCountKey !== filterKey) {
    setVisibleCountKey(filterKey);
    setVisibleCount(50);
  }
  function handleTableScroll(
  event: UIEvent<HTMLDivElement>,
) {
  const container = event.currentTarget;

  const distanceFromBottom =
    container.scrollHeight -
    container.scrollTop -
    container.clientHeight;

  if (distanceFromBottom > 300) {
    return;
  }

  setVisibleCount((current) =>
    Math.min(
      current + 50,
      filteredRows.length,
    ),
  );
}

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            2026 season
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Cash Cows
          </h1>

          <p className="mt-4 text-slate-300">
            Compare projected cash generation, breakevens and price rises across every Supercoach player.
          </p>

          <DataFreshness />
        </div>

        <section className="mt-8 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:grid-cols-2 lg:grid-cols-5">
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
            Position
          </span>

          <select
            value={positionFilter}
            onChange={(event) =>
              setPositionFilter(
                event.target.value as PositionFilter,
              )
            }
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-violet-500"
          >
            <option value="ALL">All</option>
            <option value="DEF">DEF</option>
            <option value="MID">MID</option>
            <option value="RUC">RUC</option>
            <option value="FWD">FWD</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Price
          </span>

          <select
            value={priceFilter}
            onChange={(event) =>
              setPriceFilter(
                event.target.value as PriceFilter,
              )
            }
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-violet-500"
          >
            <option value="all">All</option>
            <option value="rookies">
              Rookies (&lt;$300k)
            </option>
            <option value="mid-pricers">
              Mid-pricers
            </option>
            <option value="premiums">
              Premiums
            </option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Club
          </span>

          <select
            value={clubFilter}
            onChange={(event) =>
              setClubFilter(event.target.value)
            }
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-violet-500"
          >
            <option value="ALL">All Clubs</option>

            {clubs.map((club) => (
              <option
                key={club}
                value={club}
              >
                {club}
              </option>
            ))}
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

              <option value="price-high">
                Price: High to Low
              </option>

              <option value="price-low">
                Price: Low to High
              </option>

              <option value="breakeven-low">
                Breakeven: Low to High
              </option>

              <option value="breakeven-high">
                Breakeven: High to Low
              </option>
            </select>
          </label>
        </section>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs">
          <span className="font-semibold text-slate-300">
            Price Rise Guide
          </span>

          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="text-red-400">●</span>
            Loss
          </span>

          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="text-slate-300">●</span>
            $0–$9.9k
          </span>

          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="text-blue-400">●</span>
            $10k–$19.9k
          </span>

          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="text-amber-400">●</span>
            $20k–$29.9k
          </span>

          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="text-emerald-400">●</span>
            $30k+
          </span>
        </div>

        <p className="text-xs text-slate-500">
          Showing {visibleRows.length} of {filteredRows.length} players
        </p>

        <section className="mt-3 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
           <div
                className="max-h-[70vh] overflow-auto"
                onScroll={handleTableScroll}
              >
            <table className="w-full min-w-[1500px] whitespace-nowrap text-sm">
              <thead className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="sticky left-0 z-40 w-[180px] min-w-[180px] max-w-[180px] whitespace-normal bg-slate-950 px-4 py-3">
                    Player
                  </th>

                  <th className="z-40 w-[100px] sm:sticky sm:left-[180px] min-w-[100px] max-w-[100px] border-r border-slate-700 bg-slate-950 px-3 py-3 text-right shadow-[5px_0_8px_rgba(0,0,0,0.18)]">
                    Price
                  </th>

                  <th className="w-[100px] min-w-[100px] px-3 py-3 text-right">
                    BE
                  </th>

                  <th className="w-[100px] min-w-[100px] px-3 py-3 text-right">
                    Proj Avg
                  </th>

                  <th className="w-[100px] min-w-[100px] px-3 py-3 text-right">
                    Topped Out Gain
                  </th>

                  <th className="w-[100px] min-w-[100px] px-3 py-3 text-right">
                    Topped Out Rd
                  </th>

                  <th className="w-[100px] min-w-[100px] px-3 py-3 text-right">
                    +1R
                  </th>

                  <th className="w-[100px] min-w-[100px] px-3 py-3 text-right">
                    +3R
                  </th>

                  <th className="w-[100px] min-w-[100px] px-3 py-3 text-right">
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
                    <td className="sticky left-0 z-10 w-[180px] min-w-[180px] max-w-[180px] whitespace-normal bg-slate-900 px-4 py-3">
                      <Link
                        href={`/projector?player=${row.player.id}`}
                        className="font-semibold text-white hover:text-violet-400"
                        title={row.player.name}
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

                    <td className="z-20 w-[100px] sm:sticky sm:left-[180px] min-w-[100px] max-w-[100px] border-r border-slate-700 bg-slate-900 px-3 py-3 text-right tabular-nums shadow-[5px_0_8px_rgba(0,0,0,0.18)] group-hover:bg-slate-800">
                      {formatMoney(
                        row.player.price,
                      )}
                    </td>

                    <td className="px-3 py-3 text-right tabular-nums text-slate-300">
                      {row.player.breakeven}
                    </td>

                    <td className="px-3 py-3 text-right tabular-nums text-slate-300">
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
          <div
         className={`font-semibold tabular-nums ${getGainColour(
            projectedRound.price - row.player.price,
          )}`}
        >
          {formatMoney(projectedRound.price)}
        </div>

        <input
            type="text"
            inputMode="numeric"
            aria-label={`${row.player.name} round ${round} score`}
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
                    <div className="flex flex-col items-center gap-3">
                    <p>
                      No matching players with enough score history.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setPositionFilter("ALL");
                        setPriceFilter("all");
                        setClubFilter("ALL");
                        setProjectionMode("projected");
                        setSortMode("peak-gain");
                      }}
                      className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/20"
                    >
                      Reset Filters
                    </button>
                  </div>
                  </tr>
                )}
               </tbody>
            </table>
            {visibleRows.length < filteredRows.length && (
            <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 text-center text-xs text-slate-500">
              Scroll to load more players
            </div>
          )}

          {filteredRows.length > 50 &&
            visibleRows.length === filteredRows.length && (
              <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 text-center text-xs text-slate-600">
                All {filteredRows.length} players loaded
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}