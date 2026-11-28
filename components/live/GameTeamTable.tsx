"use client";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import PlayerCell from "@/components/ui/PlayerCell";
import TeamChip from "@/components/ui/TeamChip";
import { formatChange, formatMoney } from "@/lib/format";
import { teamTotals } from "@/lib/games/stats";
import type { GamePlayer } from "@/lib/games/types";

export type GameTableView = "stats" | "price";

const show = (value: number | null) => (value === null ? "-" : value);
const money = (value: number | null) => (value === null ? "-" : formatMoney(value));
const changeColour = (value: number | null) =>
  value === null || value === 0 ? "text-slate-400" : value > 0 ? "text-emerald-400" : "text-red-400";

type Column = DataTableColumn<GamePlayer>;

const playerColumn: Column = {
  id: "player",
  header: "Player",
  width: { base: 150, sm: 190 },
  sortValue: (p) => p.name,
  firstSortDirection: "asc",
  cell: (p) => (
    <PlayerCell
      name={p.name}
      team={p.team}
      positions={p.positions}
      href={`/projector?player=${p.id}`}
    />
  ),
};

const scColumn: Column = {
  id: "sc",
  header: "SC",
  label: "SuperCoach score",
  width: 38,
  align: "right",
  sortValue: (p) => p.score,
  cell: (p) => p.score,
  cellClassName: () => "font-bold text-white",
};

const togColumn: Column = {
  id: "tog",
  header: "TOG%",
  label: "Time on ground %",
  width: 50,
  align: "right",
  sortValue: (p) => p.tog,
  cell: (p) => show(p.tog),
};

const stat = (id: string, header: string, label: string, width: number, key: keyof GamePlayer): Column => ({
  id,
  header,
  label,
  width,
  align: "right",
  sortValue: (p) => p[key] as number | null,
  cell: (p) => show(p[key] as number | null),
});

const priceChangeColumn = (id: string, header: string, label: string): Column => ({
  id,
  header,
  label,
  width: 86,
  align: "right",
  sortValue: (p) => p.priceChange,
  cell: (p) => formatChange(p.priceChange),
  cellClassName: (p) => changeColour(p.priceChange),
});

function statsColumns(showTog: boolean): Column[] {
  return [
    playerColumn,
    scColumn,
    stat("d", "D", "Disposals", 32, "disposals"),
    stat("k", "K", "Kicks", 30, "kicks"),
    stat("hb", "HB", "Handballs", 34, "handballs"),
    stat("m", "M", "Marks", 30, "marks"),
    stat("t", "T", "Tackles", 30, "tackles"),
    stat("min", "MIN", "Minutes", 42, "minutes"),
    ...(showTog ? [togColumn] : []),
    stat("ho", "HO", "Hitouts", 36, "hitouts"),
    stat("g", "G", "Goals", 30, "goals"),
    priceChangeColumn("price", "± Price", "Price change"),
  ];
}

/**
 * The Live view's price columns for a finished game: BE is what he needed
 * that round, Price what he cost going in, New price the published price
 * after it, and Next BE his breakeven for the following round.
 */
function priceColumns(showTog: boolean): Column[] {
  return [
    playerColumn,
    scColumn,
    ...(showTog ? [togColumn] : []),
    {
      id: "be",
      header: "BE",
      label: "Breakeven this round",
      width: 40,
      align: "right",
      sortValue: (p) => p.breakeven,
      cell: (p) => show(p.breakeven),
      // Above or below what he needed.
      cellClassName: (p) =>
        p.breakeven === null ? "text-slate-400" : p.score >= p.breakeven ? "text-emerald-400" : "text-red-400",
    },
    {
      id: "before",
      header: "Price",
      label: "Price going into the round",
      width: 80,
      align: "right",
      sortValue: (p) => p.priceBefore,
      cell: (p) => money(p.priceBefore),
    },
    {
      id: "after",
      header: "New price",
      label: "Published price after the round",
      width: 84,
      align: "right",
      sortValue: (p) => p.price,
      cell: (p) => money(p.price),
      cellClassName: () => "font-semibold text-white",
    },
    priceChangeColumn("change", "Δ Round", "Price change this round"),
    {
      id: "next",
      header: "Next BE",
      label: "Breakeven for the next round",
      width: 60,
      align: "right",
      sortValue: (p) => p.nextBreakeven,
      cell: (p) => show(p.nextBreakeven),
    },
  ];
}

/**
 * One team's players in a game, as Stats (SC, D, K, HB, M, T, then MIN,
 * TOG%, HO, G and the price change) or Price (SC, TOG%, BE, Price, New
 * price, Δ Round, Next BE). On phones the first columns fit the screen and
 * the rest scroll sideways (sticky header and player column). Sorted by
 * SC, highest first.
 */
export default function GameTeamTable({
  teamName,
  team,
  players,
  showTog,
  view = "stats",
}: {
  teamName: string;
  team: string;
  players: GamePlayer[];
  /** Hide TOG% when no player in the game has it. */
  showTog: boolean;
  view?: GameTableView;
}) {
  const totals = teamTotals(players);

  return (
    <section aria-label={`${teamName} players`}>
      <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <TeamChip team={team} size={24} />
        {teamName}
      </h2>
      <DataTable
        // A fresh table per view, so the sort starts at SC again.
        key={view}
        caption={`${teamName} player ${view === "price" ? "prices" : "stats"}`}
        rows={players}
        columns={view === "price" ? priceColumns(showTog) : statsColumns(showTog)}
        rowKey={(p) => p.id}
        defaultSort={{ columnId: "sc", direction: "desc" }}
        compact
        fitToViewport={false}
        empty="No player stats for this team."
        totals={
          view === "stats"
            ? {
                player: "Team totals",
                d: totals.disposals,
                k: totals.kicks,
                hb: totals.handballs,
                m: totals.marks,
                t: totals.tackles,
                ho: totals.hitouts,
                g: totals.goals,
              }
            : undefined
        }
      />
    </section>
  );
}
