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

import AvailabilityBadge from "@/components/ui/AvailabilityBadge";
import AvailabilitySampleNotice from "@/components/ui/AvailabilitySampleNotice";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { availabilityFor, availabilitySnapshot, selectionDataLoaded } from "@/lib/availability";
import { matchesAvailabilityFilter, type AvailabilityFilter } from "@/lib/availability/filter";
import PlayerCell from "@/components/ui/PlayerCell";
import PlayerListFilterControl, {
  EmptyWatchlistMessage,
  type PlayerListFilter,
} from "@/components/ui/PlayerListFilter";
import WatchlistStar from "@/components/ui/WatchlistStar";
import { useWatchlist } from "@/lib/watchlist/useWatchlist";
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
const PLAYER_IDS: ReadonlySet<number> = new Set(players.map((player) => player.id));

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
  projectedAverage: "Proj",
  toppedOutRound: "Peak Rd",
  toppedOutGain: "Peak gain",
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

  // Status filter (All / Available / Selected) for the next round.
  const [availabilityFilter, setAvailabilityFilter] =
    useState<AvailabilityFilter>("all");

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
    availabilityFilter !== "all",
  ].filter(Boolean).length;

  function resetFilters() {
    setSearchQuery("");
    setPositionFilter("ALL");
    setPriceFilter("all");
    setClubFilter("ALL");
    setAvailabilityFilter("all");
    setListFilter("all");
    setProjectionMode("projected");
    setSort(DEFAULT_SORT);
  }

  const [scoreOverrides, setScoreOverrides] =
  useState<CashCowScoreOverrides>({});

  // Next round's k updates from live scores as games finish.
  const { contexts, isLive } = useLiveRoundContext();

  // All players | My team | Watchlist.
  const myTeam = useMyTeam();
  const watchlist = useWatchlist(PLAYER_IDS);
  const [listFilter, setListFilter] = useState<PlayerListFilter>("all");
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
        (listFilter !== "my-team" || myTeamIds.has(row.player.id)) &&
        (listFilter !== "watchlist" || watchlist.ids.has(row.player.id)) &&
        matchesAvailabilityFilter(
          row.player,
          availabilityFilter,
          CURRENT_COMPLETED_ROUND + 1,
          availabilitySnapshot,
        )
      );
    });

  // The whole list is sorted here, before paging, so the table only
  // shows the sort (manualSorting).
  return sortRows(rows, SORT_VALUES[sort.columnId], sort.direction);
}, [
  listFilter,
  myTeamIds,
  watchlist.ids,
  availabilityFilter,
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
    listFilter,
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
    info: string,
  ): DataTableColumn<CashCowRow> => ({
    id,
    header,
    info,
    width: 80,
    align: "right",
    sortValue: SORT_VALUES[id],
    cell: (row) => formatGain(value(row)),
    cellClassName: (row) => `font-semibold ${getGainColour(value(row))}`,
  });

  const columns: DataTableColumn<CashCowRow>[] = [
    {
      id: "player",
      header: "Player",
      // Two lines of name, plus the 24px watchlist star.
      width: { base: 174, sm: 200 },
      sortValue: SORT_VALUES.player,
      firstSortDirection: "asc",
      cell: (row) => (
        <PlayerCell
          name={row.player.name}
          team={row.player.team}
          positions={row.player.positions}
          href={`/projector?player=${row.player.id}`}
          leading={
            <WatchlistStar
              playerId={row.player.id}
              playerName={row.player.name}
              watchlist={watchlist}
            />
          }
          trailing={
            <AvailabilityBadge
              info={availabilityFor(row.player, CURRENT_COMPLETED_ROUND + 1)}
            />
          }
        />
      ),
    },
    {
      id: "price",
      header: "Price",
      info: "Current price.",
      width: 92,
      align: "right",
      // Pinned next to the player from the sm breakpoint up.
      pinFrom: "sm",
      sortValue: SORT_VALUES.price,
      cell: (row) => formatMoney(row.player.price),
    },
    {
      id: "breakeven",
      header: "BE",
      info: "Breakeven: the score needed next round to hold the current price.",
      width: 64,
      align: "right",
      sortValue: SORT_VALUES.breakeven,
      firstSortDirection: "asc",
      cell: (row) => row.player.breakeven,
      cellClassName: () => "text-slate-300",
    },
    {
      id: "projectedAverage",
      header: "Proj",
      info: "The projected average score used for these projections.",
      width: 72,
      align: "right",
      sortValue: SORT_VALUES.projectedAverage,
      cell: (row) => row.projectedAverage,
      cellClassName: () => "text-slate-300",
    },
    {
      ...gainColumn(
        "toppedOutGain",
        "Peak gain",
        (row) => row.toppedOutGain,
        "Total price rise from now until the price stops rising, using the projected scores.",
      ),
      width: 112,
    },
    {
      id: "toppedOutRound",
      header: "Peak Rd",
      info: "The round the price stops rising.",
      width: 96,
      align: "right",
      sortValue: SORT_VALUES.toppedOutRound,
      firstSortDirection: "asc",
      cell: (row) =>
        row.toppedOutRound === null ? "-" : `R${row.toppedOutRound}`,
      cellClassName: () => "text-slate-300",
    },
    gainColumn("rise1", "+1R", (row) => row.rise1, "Price change over the next round."),
    gainColumn("rise3", "+3R", (row) => row.rise3, "Price change over the next 3 rounds."),
    gainColumn("rise5", "+5R", (row) => row.rise5, "Price change over the next 5 rounds."),
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
                Peak gain
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

            <PlayerListFilterControl
              value={listFilter}
              onChange={setListFilter}
              myTeamCount={myTeamIds.size}
              watchlistCount={watchlist.count}
            />

            <div
              role="group"
              aria-label={`Status for Round ${CURRENT_COMPLETED_ROUND + 1}`}
              className="inline-flex rounded-lg border border-slate-700 p-0.5"
            >
              {(["all", "available", "selected"] as const).map((option) => {
                const disabled = option === "selected" && !selectionDataLoaded;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={availabilityFilter === option}
                    disabled={disabled}
                    title={disabled ? "No team selections loaded yet" : undefined}
                    onClick={() => setAvailabilityFilter(option)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      availabilityFilter === option
                        ? "bg-violet-500/25 text-violet-100"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    {option === "all" ? "All" : option === "available" ? "Available" : "Selected"}
                  </button>
                );
              })}
            </div>

            {!selectionDataLoaded && (
              <span className="text-xs text-slate-500">No team selections loaded yet</span>
            )}

            <AvailabilitySampleNotice />

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
          singleLineHeaders
          highlightRow={(row) => myTeamIds.has(row.player.id)}
          onNearEnd={loadMoreRows}
          empty={
            listFilter === "watchlist" && watchlist.count === 0 ? (
              <EmptyWatchlistMessage />
            ) : (
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
            )
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