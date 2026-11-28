"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";

import PriceRangeControl from "@/components/cashcows/PriceRangeControl";
import PreseasonPage from "@/components/season/PreseasonNotice";
import Header from "@/components/layout/Header";
import LiveIndicator from "@/components/layout/LiveIndicator";
import PageHeader from "@/components/layout/PageHeader";
import AvailabilityBadge from "@/components/ui/AvailabilityBadge";
import AvailabilitySampleNotice from "@/components/ui/AvailabilitySampleNotice";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import InfoPopover from "@/components/ui/InfoPopover";
import MatchupSwitch from "@/components/ui/MatchupSwitch";
import PlayerCell from "@/components/ui/PlayerCell";
import PlayerListFilterControl, {
  EmptyWatchlistMessage,
  type PlayerListFilter,
} from "@/components/ui/PlayerListFilter";
import WatchlistStar from "@/components/ui/WatchlistStar";
import { CURRENT_COMPLETED_ROUND, FINAL_ROUND, IS_PRESEASON } from "@/data/season";
import { availabilityFor, availabilitySnapshot, selectionDataLoaded } from "@/lib/availability";
import { matchesAvailabilityFilter, type AvailabilityFilter } from "@/lib/availability/filter";
import { calculateCashCowRows } from "@/lib/cashcows";
import type { CashCowScoreOverrides } from "@/lib/cashcows";
import { matchupLabel } from "@/lib/cashcows/matchupLabel";
import {
  NO_PRICE_RANGE,
  isPriceRangeActive,
  matchesPriceRange,
  priceRangeLabel,
  priceSliderBounds,
  type PriceRange,
} from "@/lib/cashcows/priceRange";
import { useMatchupSetting } from "@/lib/fixtureDifficulty/useMatchupSetting";
import { formatChange, formatMoney } from "@/lib/format";
import { useLiveRoundContext } from "@/lib/liveMatch/useLiveRoundContext";
import { useMyTeam } from "@/lib/planner/useMyTeam";
import type { ProjectionMode } from "@/lib/projector";
import { parseProjectionMode } from "@/lib/projector/projectionModes";
import { playerRepository } from "@/lib/repository/PlayerRepository";
import { sortRows, type SortState, type SortValue } from "@/lib/table/sortRows";
import { SM_UP, useMediaQuery } from "@/lib/ui/useMediaQuery";
import { useWatchlist } from "@/lib/watchlist/useWatchlist";

type SortMode =
  | "peak-gain"
  | "rise-1"
  | "rise-3"
  | "rise-5"
  | "price-high"
  | "price-low"
  | "breakeven-low"
  | "breakeven-high";

type PositionFilter = "ALL" | "DEF" | "MID" | "RUC" | "FWD";

/** How many future round columns to show. "none" is phones only (their default). */
type RoundsShown = "none" | "3" | "6" | "all";

const players = playerRepository.getAll();
const PLAYER_IDS: ReadonlySet<number> = new Set(players.map((player) => player.id));
const PRICE_BOUNDS = priceSliderBounds(players.map((player) => player.price));

const clubs = Array.from(new Set(players.map((player) => player.team))).sort((a, b) => a.localeCompare(b));

const futureRounds = Array.from(
  { length: FINAL_ROUND - CURRENT_COMPLETED_ROUND },
  (_, index) => CURRENT_COMPLETED_ROUND + index + 1,
);

const formatGain = formatChange;

function getGainColour(value: number | null): string {
  if (value === null) return "text-slate-400";
  if (value < 0) return "text-red-400";
  if (value < 10_000) return "text-slate-300";
  if (value < 20_000) return "text-blue-400";
  if (value < 30_000) return "text-amber-400";
  return "text-emerald-400";
}

type CashCowRow = ReturnType<typeof calculateCashCowRows>[number];

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

const SORT_LABELS: Record<SortMode, string> = {
  "peak-gain": "Peak gain",
  "rise-1": "+1 Round",
  "rise-3": "+3 Rounds",
  "rise-5": "+5 Rounds",
  "price-high": "Price: High to Low",
  "price-low": "Price: Low to High",
  "breakeven-low": "Breakeven: Low to High",
  "breakeven-high": "Breakeven: High to Low",
};

const DEFAULT_SORT = SORT_MODES["peak-gain"];

/** The dropdown mode for a sort, or null if only a header click gives it. */
function sortModeFor(sort: SortState): SortMode | null {
  const match = Object.entries(SORT_MODES).find(
    ([, mode]) => mode.columnId === sort.columnId && mode.direction === sort.direction,
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

const AVAILABILITY_LABELS: Record<AvailabilityFilter, string> = {
  all: "All",
  available: "Available",
  selected: "Selected",
};

const control =
  "h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20";

export default function CashCowsPage() {
  // No players or prices before the season's AFL SuperCoach launch.
  if (IS_PRESEASON) {
    return (
      <PreseasonPage
        title="Cash Cows"
        description="Compare projected cash generation, breakevens and price rises across every AFL SuperCoach player."
      />
    );
  }

  return <CashCows />;
}

function CashCows() {
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>("projected");
  const [searchQuery, setSearchQuery] = useState("");

  // Shared by the sort dropdown and the sortable column headers.
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const sortMode = sortModeFor(sort);

  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [priceRange, setPriceRange] = useState<PriceRange>(NO_PRICE_RANGE);
  const [clubFilter, setClubFilter] = useState("ALL");
  // Status filter (All / Available / Selected) for the next round.
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [visibleCount, setVisibleCount] = useState(50);

  // Phones: position, price, club and status sit behind "Filters".
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Round columns: Next 6 on desktop; hidden on phones until chosen.
  const smUp = useMediaQuery(SM_UP, true);
  const [roundsChoice, setRoundsChoice] = useState<RoundsShown | null>(null);
  const roundsShown: RoundsShown =
    roundsChoice === "none" && smUp ? "6" : (roundsChoice ?? (smUp ? "6" : "none"));
  const shownRounds =
    roundsShown === "none"
      ? []
      : roundsShown === "all"
        ? futureRounds
        : futureRounds.slice(0, Number(roundsShown));

  // "Matchup adjustment": one setting shared with the Projector and planner.
  const [matchupOn, setMatchupOn] = useMatchupSetting();

  const [scoreOverrides, setScoreOverrides] = useState<CashCowScoreOverrides>({});

  // Next round's k updates from live scores as games finish.
  const { contexts, isLive } = useLiveRoundContext();

  // All players | My team | Watchlist.
  const myTeam = useMyTeam();
  const watchlist = useWatchlist(PLAYER_IDS);
  const [listFilter, setListFilter] = useState<PlayerListFilter>("all");
  const myTeamIds = useMemo(() => new Set((myTeam?.players ?? []).map((p) => p.id)), [myTeam]);

  // Filters inside the phone "Filters" panel.
  const panelFilterCount = [
    positionFilter !== "ALL",
    isPriceRangeActive(priceRange),
    clubFilter !== "ALL",
    availabilityFilter !== "all",
  ].filter(Boolean).length;

  function clearFilters() {
    setSearchQuery("");
    setPositionFilter("ALL");
    setPriceRange(NO_PRICE_RANGE);
    setClubFilter("ALL");
    setAvailabilityFilter("all");
    setListFilter("all");
  }

  function resetFilters() {
    clearFilters();
    setProjectionMode("projected");
    setSort(DEFAULT_SORT);
  }

  const filteredRows = useMemo(() => {
    const normalisedSearch = searchQuery.trim().toLowerCase();

    const rows = calculateCashCowRows(players, projectionMode, scoreOverrides, contexts, {
      matchup: matchupOn,
    }).filter(
      (row) =>
        (normalisedSearch === "" || row.player.name.toLowerCase().includes(normalisedSearch)) &&
        (positionFilter === "ALL" || row.player.positions.includes(positionFilter)) &&
        (clubFilter === "ALL" || row.player.team === clubFilter) &&
        // The current price (after the as-of round).
        matchesPriceRange(row.player.price, priceRange) &&
        (listFilter !== "my-team" || myTeamIds.has(row.player.id)) &&
        (listFilter !== "watchlist" || watchlist.ids.has(row.player.id)) &&
        matchesAvailabilityFilter(row.player, availabilityFilter, CURRENT_COMPLETED_ROUND + 1, availabilitySnapshot),
    );

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
    matchupOn,
    searchQuery,
    sort,
    scoreOverrides,
    positionFilter,
    priceRange,
    clubFilter,
  ]);

  const visibleRows = useMemo(() => filteredRows.slice(0, visibleCount), [filteredRows, visibleCount]);

  function updateProjectedScore(playerId: number, round: number, value: string) {
    const trimmedValue = value.trim();

    setScoreOverrides((current) => {
      const playerOverrides = { ...(current[playerId] ?? {}) };

      if (trimmedValue === "") {
        delete playerOverrides[round];

        if (Object.keys(playerOverrides).length === 0) {
          const updated = { ...current };
          delete updated[playerId];
          return updated;
        }

        return { ...current, [playerId]: playerOverrides };
      }

      const parsedScore = Number(trimmedValue);

      if (!Number.isFinite(parsedScore) || parsedScore < 0) {
        return current;
      }

      return { ...current, [playerId]: { ...playerOverrides, [round]: Math.round(parsedScore) } };
    });
  }

  // Show the first 50 rows again whenever a filter or sort changes
  // (adjusted during render rather than in an effect).
  const filterKey = [
    searchQuery,
    projectionMode,
    matchupOn,
    positionFilter,
    priceRange.min,
    priceRange.max,
    clubFilter,
    availabilityFilter,
    sort.columnId,
    sort.direction,
    listFilter,
  ].join("|");

  const [visibleCountKey, setVisibleCountKey] = useState(filterKey);

  if (visibleCountKey !== filterKey) {
    setVisibleCountKey(filterKey);
    setVisibleCount(50);
  }

  function loadMoreRows() {
    setVisibleCount((current) => Math.min(current + 50, filteredRows.length));
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
          leading={<WatchlistStar playerId={row.player.id} playerName={row.player.name} watchlist={watchlist} />}
          trailing={<AvailabilityBadge info={availabilityFor(row.player, CURRENT_COMPLETED_ROUND + 1)} />}
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
      cell: (row) => (row.toppedOutRound === null ? "-" : `R${row.toppedOutRound}`),
      cellClassName: () => "text-slate-300",
    },
    gainColumn("rise1", "+1R", (row) => row.rise1, "Price change over the next round."),
    gainColumn("rise3", "+3R", (row) => row.rise3, "Price change over the next 3 rounds."),
    gainColumn("rise5", "+5R", (row) => row.rise5, "Price change over the next 5 rounds."),
    ...shownRounds.map(
      (round): DataTableColumn<CashCowRow> => ({
        id: `round-${round}`,
        header: `R${round}`,
        width: 80,
        align: "right",
        cell: (row) => {
          const projectedRound = row.projectedRounds.find((item) => item.round === round);

          if (!projectedRound) {
            return <span className="text-slate-400">-</span>;
          }

          const overriddenScore = scoreOverrides[row.player.id]?.[round];
          const matchup = overriddenScore === undefined ? matchupLabel(projectedRound) : null;

          return (
            // On phones the adjustment is in the tooltip; from sm up it's shown.
            <div title={matchup ? `Matchup adjustment: ${matchup}` : undefined}>
              <div className={`text-xs font-semibold ${getGainColour(projectedRound.price - row.player.price)}`}>
                {formatMoney(projectedRound.price)}
              </div>

              <input
                type="text"
                inputMode="numeric"
                aria-label={`${row.player.name} round ${round} score${matchup ? ` (${matchup})` : ""}`}
                value={overriddenScore ?? projectedRound.score}
                onChange={(event) => updateProjectedScore(row.player.id, round, event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                className={`mt-0.5 w-10 rounded border px-1.5 py-0.5 text-right text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                  overriddenScore !== undefined
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-700 bg-slate-950 text-slate-400"
                }`}
              />

              {matchup && (
                <div className="mt-0.5 hidden text-[10px] leading-3 tabular-nums text-slate-400 sm:block">{matchup}</div>
              )}
            </div>
          );
        },
      }),
    ),
  ];

  // Removable chips for every active filter.
  const chips: { key: string; label: string; clear: () => void }[] = [
    searchQuery.trim() && { key: "search", label: `"${searchQuery.trim()}"`, clear: () => setSearchQuery("") },
    listFilter !== "all" && {
      key: "list",
      label: listFilter === "my-team" ? "My team" : "Watchlist",
      clear: () => setListFilter("all"),
    },
    positionFilter !== "ALL" && { key: "position", label: positionFilter, clear: () => setPositionFilter("ALL") },
    isPriceRangeActive(priceRange) && {
      key: "price",
      label: priceRangeLabel(priceRange),
      clear: () => setPriceRange(NO_PRICE_RANGE),
    },
    clubFilter !== "ALL" && { key: "club", label: clubFilter, clear: () => setClubFilter("ALL") },
    availabilityFilter !== "all" && {
      key: "availability",
      label: AVAILABILITY_LABELS[availabilityFilter],
      clear: () => setAvailabilityFilter("all"),
    },
  ].filter((chip): chip is { key: string; label: string; clear: () => void } => !!chip);

  // Position, price, club and status: inline from sm up, in the panel on phones.
  const panelFilters = (
    <>
      <label className="block sm:w-auto">
        <span className="mb-1 block text-xs font-semibold text-slate-400 sm:hidden">Position</span>
        <select
          aria-label="Position"
          value={positionFilter}
          onChange={(event) => setPositionFilter(event.target.value as PositionFilter)}
          className={`${control} w-full sm:w-auto`}
        >
          <option value="ALL">All positions</option>
          <option value="DEF">DEF</option>
          <option value="MID">MID</option>
          <option value="RUC">RUC</option>
          <option value="FWD">FWD</option>
        </select>
      </label>

      <div>
        <span className="mb-1 block text-xs font-semibold text-slate-400 sm:hidden">Price</span>
        <PriceRangeControl value={priceRange} onChange={setPriceRange} bounds={PRICE_BOUNDS} className="sm:w-28" />
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-400 sm:hidden">Club</span>
        <select
          aria-label="Club"
          value={clubFilter}
          onChange={(event) => setClubFilter(event.target.value)}
          className={`${control} w-full sm:w-auto`}
        >
          <option value="ALL">All clubs</option>
          {clubs.map((club) => (
            <option key={club} value={club}>
              {club}
            </option>
          ))}
        </select>
      </label>

      <div className="col-span-2 sm:col-span-1">
        <span className="mb-1 block text-xs font-semibold text-slate-400 sm:hidden">
          Status for Round {CURRENT_COMPLETED_ROUND + 1}
        </span>
        <div
          role="group"
          aria-label={`Status for Round ${CURRENT_COMPLETED_ROUND + 1}`}
          className="inline-flex h-11 items-center rounded-lg border border-slate-700 p-0.5"
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
                className={`h-full rounded-md px-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  availabilityFilter === option ? "bg-violet-500/25 text-violet-100" : "text-slate-300 hover:text-white"
                }`}
              >
                {AVAILABILITY_LABELS[option]}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader
          compact
          title="Cash Cows"
          description="Compare projected cash generation, breakevens and price rises across every AFL SuperCoach player."
        />

        {/* Row 1: search, which players, and (phones) Filters or (sm up) the filters inline. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 sm:max-w-56 sm:flex-none">
            <span className="sr-only">Search players</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search player..."
              className={`${control} w-full pl-9`}
            />
          </label>

          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="cash-cow-filters"
            onClick={() => setFiltersOpen((current) => !current)}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-white sm:hidden"
          >
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            Filters
            {panelFilterCount > 0 && (
              <span className="rounded-full bg-violet-500/25 px-1.5 text-xs text-violet-200">{panelFilterCount}</span>
            )}
          </button>

          <PlayerListFilterControl
            value={listFilter}
            onChange={setListFilter}
            myTeamCount={myTeamIds.size}
            watchlistCount={watchlist.count}
          />

          <div
            id="cash-cow-filters"
            className={`${
              filtersOpen ? "grid" : "hidden"
            } w-full grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0`}
          >
            {panelFilters}
          </div>
        </div>

        {/* Row 2: projection, sort, matchup adjustment, rounds shown. */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label>
            <span className="sr-only">Projection</span>
            <select
              aria-label="Projection"
              value={projectionMode}
              onChange={(event) => setProjectionMode(parseProjectionMode(event.target.value))}
              className={control}
            >
              <option value="projected">Projected</option>
              <option value="season-average">Season Avg</option>
              <option value="three-round-average">3RA</option>
              <option value="five-round-average">5RA</option>
            </select>
          </label>

          <label>
            <span className="sr-only">Sort</span>
            <select
              aria-label="Sort"
              value={sortMode ?? "column"}
              onChange={(event) => {
                const mode = event.target.value as SortMode | "column";
                if (mode !== "column") setSort(SORT_MODES[mode]);
              }}
              className={control}
            >
              {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {SORT_LABELS[mode]}
                </option>
              ))}

              {/* Shown when a column header sort has no matching mode. */}
              {sortMode === null && (
                <option value="column" disabled>
                  {COLUMN_NAMES[sort.columnId] ?? "Column"}: {sort.direction === "asc" ? "Low to High" : "High to Low"}
                </option>
              )}
            </select>
          </label>

          <MatchupSwitch on={matchupOn} onChange={setMatchupOn} />

          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            Rounds shown
            <select
              value={roundsShown}
              onChange={(event) => setRoundsChoice(event.target.value as RoundsShown)}
              className={control}
            >
              {!smUp && <option value="none">Hidden</option>}
              <option value="3">Next 3</option>
              <option value="6">Next 6</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>

        {/* Status line: count, removable filter chips, guides. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <p role="status" className="font-semibold text-slate-300">
            {filteredRows.length} {filteredRows.length === 1 ? "player" : "players"}
          </p>

          {chips.length > 0 && (
            <ul aria-label="Active filters" className="flex flex-wrap items-center gap-1.5">
              {chips.map((chip) => (
                <li key={chip.key}>
                  <button
                    type="button"
                    onClick={chip.clear}
                    aria-label={`Remove filter: ${chip.label}`}
                    className="inline-flex min-h-7 items-center gap-1 rounded-full border border-violet-500/50 bg-violet-500/10 pl-2.5 pr-1.5 font-semibold text-violet-100 hover:border-violet-400"
                  >
                    {chip.label}
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="min-h-7 rounded-md px-1.5 font-semibold text-slate-300 underline-offset-2 hover:text-white hover:underline"
                >
                  Clear all
                </button>
              </li>
            </ul>
          )}

          <InfoPopover label="Price Rise Guide" widthRem={15}>
            <span className="block font-semibold">Price Rise Guide</span>
            <span className="mt-1 block">
              <span className="text-red-400">●</span> Loss
            </span>
            <span className="block">
              <span className="text-slate-300">●</span> $0–$9.9k
            </span>
            <span className="block">
              <span className="text-blue-400">●</span> $10k–$19.9k
            </span>
            <span className="block">
              <span className="text-amber-400">●</span> $20k–$29.9k
            </span>
            <span className="block">
              <span className="text-emerald-400">●</span> $30k+
            </span>
          </InfoPopover>

          {isLive && <LiveIndicator />}

          {!selectionDataLoaded && <span className="text-slate-500">No team selections loaded yet</span>}

          <AvailabilitySampleNotice />

          {myTeamIds.size > 0 && (
            <span className="flex items-center gap-1.5 text-slate-400">
              <span
                aria-hidden="true"
                className="inline-block h-3.5 w-3.5 rounded-sm border-l-[3px] border-brand-green bg-[var(--dt-highlight-bg)]"
              />
              Your players
            </span>
          )}
        </div>

        <DataTable
          className="mt-2"
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
                <p className="font-semibold text-white">No players match these filters.</p>

                <p className="text-sm text-slate-400">
                  Players need at least two scores before their price can change, so some players are not listed.
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
