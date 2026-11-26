"use client";

import LiveIndicator from "@/components/layout/LiveIndicator";
import { useLiveRoundContext } from "@/lib/liveMatch/useLiveRoundContext";
import { useMyTeam } from "@/lib/planner/useMyTeam";
import PageHeader from "@/components/layout/PageHeader";
import { formatChange, formatMoney } from "@/lib/format";
import Header from "@/components/layout/Header";
import {
  useMemo,
  useState,
} from "react";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import PlayerCell from "@/components/ui/PlayerCell";
import {
  sortRows,
  type SortState,
  type SortValue,
} from "@/lib/table/sortRows";

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

const formatGain = formatChange;

function getGainColour(
  value: number | null,
): string {
  if (value === null) {
    return "text-slate-400";
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

/** What each sortable column sorts by (missing values sort last). */
const SORT_VALUES: Record<string, (row: CashCowRow) => SortValue> = {
  player: (row) => row.player.name,
  price: (row) => row.player.price,
  breakeven: (row) => row.player.breakeven,
  projectedAverage: (row) => row.projectedAverage,
  toppedOutGain: (row) => row.toppedOutGain,
  toppedOutRound: (row) => row.toppedOutRound,
  rise1: (row) => row.rise1,
  rise3: (row) => row.rise3,
  rise5: (row) => row.rise5,
};

/** The sort dropdown's modes, each a column and direction. */
const SORT_MODES: Record<SortMode, SortState> = {
  "peak-gain": { columnId: "toppedOutGain", direction: "desc" },
  "rise-1": { columnId: "rise1", direction: "desc" },
  "rise-3": { columnId: "rise3", direction: "desc" },
  "rise-5": { columnId: "rise5", direction: "desc" },
  "price-high": { columnId: "price", direction: "desc" },
  "price-low": { columnId: "price", direction: "asc" },
  "breakeven-low": { columnId: "breakeven", direction: "asc" },
  "breakeven-high": { columnId: "breakeven", direction: "desc" },
};

const DEFAULT_SORT = SORT_MODES["peak-gain"];

/** The dropdown mode for a sort, or null if only a header click gives it. */
function sortModeFor(sort: SortState): SortMode | null {
  const match = Object.entries(SORT_MODES).find(
    ([, mode]) =>
      mode.columnId === sort.columnId && mode.direction === sort.direction,
  );

  return match ? (match[0] as SortMode) : null;
}

const COLUMN_NAMES: Record<string, string> = {
  player: "Player",
  projectedAverage: "Proj Avg",
  toppedOutRound: "Topped Out Rd",
  toppedOutGain: "Topped Out Gain",
  rise1: "+1 Round",
  rise3: "+3 Rounds",
  rise5: "+5 Rounds",
  price: "Price",
  breakeven: "Breakeven",
};

export default function CashCowsPage() {
  const [projectionMode, setProjectionMode] =
    useState<ProjectionMode>("projected");

  const [searchQuery, setSearchQuery] =
    useState("");

  // Shared by the sort dropdown and the sortable column headers.
  const [sort, setSort] =
    useState<SortState>(DEFAULT_SORT);
  const sortMode = sortModeFor(sort);

  const [positionFilter, setPositionFilter] =
  useState<PositionFilter>("ALL");

  const [priceFilter, setPriceFilter] =
    useState<PriceFilter>("all");

  const [clubFilter, setClubFilter] =
    useState("ALL");

  const [visibleCount, setVisibleCount] =
    useState(50);

  // Phones: filters collapse behind a button and round columns are hidden
  // until asked for. Both are always shown from the sm breakpoint up.
  const [filtersOpen, setFiltersOpen] =
    useState(false);

  const [showRounds, setShowRounds] =
    useState(false);

  const activeFilterCount = [
    positionFilter !== "ALL",
    priceFilter !== "all",
    clubFilter !== "ALL",
    searchQuery.trim() !== "",
  ].filter(Boolean).length;

  function resetFilters() {
    setSearchQuery("");
    setPositionFilter("ALL");
    setPriceFilter("all");
    setClubFilter("ALL");
    setProjectionMode("projected");
    setSort(DEFAULT_SORT);
  }

  const [scoreOverrides, setScoreOverrides] =
  useState<CashCowScoreOverrides>({});

  // Next round's k updates from live scores as games finish.
  const { contexts, isLive } = useLiveRoundContext();

  // "My team" toggle: show only the players in the saved squad.
  const myTeam = useMyTeam();
  const [myTeamOnly, setMyTeamOnly] = useState(false);
  const myTeamIds = useMemo(
    () => new Set((myTeam?.players ?? []).map((p) => p.id)),
    [myTeam],
  );

  const filteredRows = useMemo(() => {
  const normalisedSearch =
    searchQuery.trim().toLowerCase();

  const rows = calculateCashCowRows(
    players,
    projectionMode,
    scoreOverrides,
    contexts,
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
        matchesPrice &&
        (!myTeamOnly || myTeamIds.has(row.player.id))
      );
    });

  // The whole list is sorted here, before paging, so the table only
  // shows the sort (manualSorting).
  return sortRows(rows, SORT_VALUES[sort.columnId], sort.direction);
}, [
  myTeamOnly,
  myTeamIds,
  contexts,
  projectionMode,
  searchQuery,
  sort,
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
    sort.columnId,
    sort.direction,
    myTeamOnly,
  ].join("|");

  const [visibleCountKey, setVisibleCountKey] =
    useState(filterKey);

  if (visibleCountKey !== filterKey) {
    setVisibleCountKey(filterKey);
    setVisibleCount(50);
  }
  function loadMoreRows() {
    setVisibleCount((current) =>
      Math.min(current + 50, filteredRows.length),
    );
  }

  const gainColumn = (
    id: string,
    header: string,
    value: (row: CashCowRow) => number | null,
  ): DataTableColumn<CashCowRow> => ({
    id,
    header,
    width: 72,
    align: "right",
    sortValue: SORT_VALUES[id],
    cell: (row) => formatGain(value(row)),
    cellClassName: (row) => `font-semibold ${getGainColour(value(row))}`,
  });

  const columns: DataTableColumn<CashCowRow>[] = [
    {
      id: "player",
      header: "Player",
      width: { base: 124, sm: 160 },
      sortValue: SORT_VALUES.player,
      firstSortDirection: "asc",
      cell: (row) => (
        <PlayerCell
          name={row.player.name}
          team={row.player.team}
          positions={row.player.positions}
          href={`/projector?player=${row.player.id}`}
        />
      ),
    },
    {
      id: "price",
      header: "Price",
      width: 84,
      align: "right",
      // Pinned next to the player from the sm breakpoint up.
      pinFrom: "sm",
      sortValue: SORT_VALUES.price,
      cell: (row) => formatMoney(row.player.price),
    },
    {
      id: "breakeven",
      header: "BE",
      width: 52,
      align: "right",
      sortValue: SORT_VALUES.breakeven,
      firstSortDirection: "asc",
      cell: (row) => row.player.breakeven,
      cellClassName: () => "text-slate-300",
    },
    {
      id: "projectedAverage",
      header: "Proj Avg",
      width: 64,
      align: "right",
      sortValue: SORT_VALUES.projectedAverage,
      cell: (row) => row.projectedAverage,
      cellClassName: () => "text-slate-300",
    },
    {
      ...gainColumn("toppedOutGain", "Topped Out Gain", (row) => row.toppedOutGain),
      width: 84,
    },
    {
      id: "toppedOutRound",
      header: "Topped Out Rd",
      width: 56,
      align: "right",
      sortValue: SORT_VALUES.toppedOutRound,
      firstSortDirection: "asc",
      cell: (row) =>
        row.toppedOutRound === null ? "-" : `R${row.toppedOutRound}`,
      cellClassName: () => "text-slate-300",
    },
    gainColumn("rise1", "+1R", (row) => row.rise1),
    gainColumn("rise3", "+3R", (row) => row.rise3),
    gainColumn("rise5", "+5R", (row) => row.rise5),
    ...futureRounds.map(
      (round): DataTableColumn<CashCowRow> => ({
        id: `round-${round}`,
        header: `R${round}`,
        width: 76,
        align: "right",
        // Hidden on phones until "Show round columns" is pressed.
        hideBelow: showRounds ? undefined : "sm",
        cell: (row) => {
          const projectedRound = row.projectedRounds.find(
            (item) => item.round === round,
          );

          if (!projectedRound) {
            return <span className="text-slate-400">-</span>;
          }

          const overriddenScore = scoreOverrides[row.player.id]?.[round];

          return (
            <>
              <div
                className={`text-xs font-semibold ${getGainColour(
                  projectedRound.price - row.player.price,
                )}`}
              >
                {formatMoney(projectedRound.price)}
              </div>

              <input
                type="text"
                inputMode="numeric"
                aria-label={`${row.player.name} round ${round} score`}
                value={overriddenScore ?? projectedRound.score}
                onChange={(event) =>
                  updateProjectedScore(
                    row.player.id,
                    round,
                    event.target.value,
                  )
                }
                onFocus={(event) => event.currentTarget.select()}
                className={`mt-0.5 w-10 rounded border px-1.5 py-0.5 text-right text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                  overriddenScore !== undefined
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-700 bg-slate-950 text-slate-400"
                }`}
              />
            </>
          );
        },
      }),
    ),
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />
      <section className="mx-auto max-w-7xl px-6 py-12">
        <PageHeader
          title="Cash Cows"
          description="Compare projected cash generation, breakevens and price rises across every SuperCoach player."
        />

        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="cash-cow-filters"
          onClick={() => setFiltersOpen((current) => !current)}
          className="mt-8 flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white sm:hidden"
        >
          <span>
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-2 rounded-full bg-violet-500/20 px-2 py-0.5 text-xs text-violet-300">
                {activeFilterCount} active
              </span>
            )}
          </span>

          <span aria-hidden="true" className="text-slate-400">
            {filtersOpen ? "▲" : "▼"}
          </span>
        </button>

        <section
          id="cash-cow-filters"
          className={`${
            filtersOpen ? "mt-3 grid" : "hidden"
          } gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:mt-8 sm:grid sm:grid-cols-2 lg:grid-cols-5`}
        >
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
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
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
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
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
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
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
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
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
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
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Sort
            </span>

            <select
              value={sortMode ?? "column"}
              onChange={(event) => {
                const mode = event.target.value as SortMode | "column";
                if (mode !== "column") setSort(SORT_MODES[mode]);
              }}
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

              {/* Shown when a column header sort has no matching mode. */}
              {sortMode === null && (
                <option value="column" disabled>
                  {COLUMN_NAMES[sort.columnId] ?? "Column"}:{" "}
                  {sort.direction === "asc" ? "Low to High" : "High to Low"}
                </option>
              )}
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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-xs text-slate-400">
              Showing {visibleRows.length} of {filteredRows.length} players
            </p>

            {isLive && <LiveIndicator />}

            <button
              type="button"
              aria-pressed={myTeamOnly}
              disabled={myTeamIds.size === 0}
              title={myTeamIds.size === 0 ? "Save a team on My Team first" : undefined}
              onClick={() => setMyTeamOnly((current) => !current)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                myTeamOnly
                  ? "border-violet-500 bg-violet-500/20 text-violet-100"
                  : "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
              }`}
            >
              My team{myTeamIds.size > 0 ? ` (${myTeamIds.size})` : ""}
            </button>

            {myTeamIds.size > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span
                  aria-hidden="true"
                  className="inline-block h-3.5 w-3.5 rounded-sm border-l-[3px] border-brand-green bg-[var(--dt-highlight-bg)]"
                />
                Your players
              </span>
            )}
          </div>

          {/* Round-by-round columns are hidden on phones unless asked for. */}
          <button
            type="button"
            aria-pressed={showRounds}
            onClick={() => setShowRounds((current) => !current)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white sm:hidden"
          >
            {showRounds
              ? "Hide round columns"
              : `Show R${futureRounds[0]}–R${futureRounds[futureRounds.length - 1]} columns`}
          </button>
        </div>

        <DataTable
          className="mt-3"
          caption="Cash cows: projected price rises by player"
          rows={visibleRows}
          columns={columns}
          rowKey={(row) => row.player.id}
          sort={sort}
          onSortChange={setSort}
          manualSorting
          highlightRow={(row) => myTeamIds.has(row.player.id)}
          onNearEnd={loadMoreRows}
          empty={
            <div role="status" className="flex max-w-xl flex-col items-start gap-3">
              <p className="font-semibold text-white">
                No players match these filters.
              </p>

              <p className="text-sm text-slate-400">
                Players need at least two scores
                before their price can change, so
                some players are not listed.
              </p>

              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/20"
              >
                Reset filters
              </button>
            </div>
          }
          footer={
            visibleRows.length < filteredRows.length
              ? "Scroll to load more players"
              : filteredRows.length > 50
                ? `All ${filteredRows.length} players loaded`
                : null
          }
        />
      </section>
    </main>
  );
}