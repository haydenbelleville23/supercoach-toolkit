"use client";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import PlayerCell from "@/components/ui/PlayerCell";
import TeamChip from "@/components/ui/TeamChip";
import { formatChange } from "@/lib/format";
import { teamTotals } from "@/lib/games/stats";
import type { GamePlayer } from "@/lib/games/types";

const show = (value: number | null) => (value === null ? "-" : value);

/**
 * One team's players in a game. On phones Player, SC, D, K, HB, M and T
 * fit the screen; the rest are reached with the table's own sideways
 * scroll (sticky header and player column). Sorted by SC, highest first.
 */
export default function GameTeamTable({
  teamName,
  team,
  players,
  showTog,
}: {
  teamName: string;
  team: string;
  players: GamePlayer[];
  /** Hide TOG% when no player in the game has it. */
  showTog: boolean;
}) {
  const columns: DataTableColumn<GamePlayer>[] = [
    {
      id: "player",
      header: "Player",
      width: { base: 116, sm: 190 },
      sortValue: (p) => p.name,
      firstSortDirection: "asc",
      cell: (p) => (
        <span className="flex min-w-0 items-center gap-1.5">
          <TeamChip team={p.team} size={16} />
          <PlayerCell
            name={p.name}
            team={p.team}
            positions={p.positions}
            badge={null}
            href={`/projector?player=${p.id}`}
          />
        </span>
      ),
    },
    { id: "sc", header: "SC", label: "SuperCoach score", width: 38, align: "right", sortValue: (p) => p.score, cell: (p) => p.score, cellClassName: () => "font-bold text-white" },
    { id: "d", header: "D", label: "Disposals", width: 32, align: "right", sortValue: (p) => p.disposals, cell: (p) => show(p.disposals) },
    { id: "k", header: "K", label: "Kicks", width: 30, align: "right", sortValue: (p) => p.kicks, cell: (p) => show(p.kicks) },
    { id: "hb", header: "HB", label: "Handballs", width: 34, align: "right", sortValue: (p) => p.handballs, cell: (p) => show(p.handballs) },
    { id: "m", header: "M", label: "Marks", width: 30, align: "right", sortValue: (p) => p.marks, cell: (p) => show(p.marks) },
    { id: "t", header: "T", label: "Tackles", width: 30, align: "right", sortValue: (p) => p.tackles, cell: (p) => show(p.tackles) },
    { id: "min", header: "MIN", label: "Minutes", width: 42, align: "right", sortValue: (p) => p.minutes, cell: (p) => show(p.minutes) },
    ...(showTog
      ? [{ id: "tog", header: "TOG%", label: "Time on ground %", width: 50, align: "right" as const, sortValue: (p: GamePlayer) => p.tog, cell: (p: GamePlayer) => show(p.tog) }]
      : []),
    { id: "ho", header: "HO", label: "Hitouts", width: 36, align: "right", sortValue: (p) => p.hitouts, cell: (p) => show(p.hitouts) },
    { id: "g", header: "G", label: "Goals", width: 30, align: "right", sortValue: (p) => p.goals, cell: (p) => show(p.goals) },
    {
      id: "price",
      header: "± Price",
      label: "Price change",
      width: 86,
      align: "right",
      sortValue: (p) => p.priceChange,
      cell: (p) => formatChange(p.priceChange),
      cellClassName: (p) =>
        p.priceChange === null || p.priceChange === 0
          ? "text-slate-400"
          : p.priceChange > 0
            ? "text-emerald-400"
            : "text-red-400",
    },
  ];

  const totals = teamTotals(players);

  return (
    <section aria-label={`${teamName} players`}>
      <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <TeamChip team={team} size={24} />
        {teamName}
      </h2>
      <DataTable
        caption={`${teamName} player stats`}
        rows={players}
        columns={columns}
        rowKey={(p) => p.id}
        defaultSort={{ columnId: "sc", direction: "desc" }}
        compact
        fitToViewport={false}
        empty="No player stats for this team."
        totals={{
          player: "Team totals",
          d: totals.disposals,
          k: totals.kicks,
          hb: totals.handballs,
          m: totals.marks,
          t: totals.tackles,
          ho: totals.hitouts,
          g: totals.goals,
        }}
      />
    </section>
  );
}
