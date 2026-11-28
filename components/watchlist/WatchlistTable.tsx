"use client";

import { useMemo } from "react";

import AvailabilityBadge from "@/components/ui/AvailabilityBadge";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import PlayerCell from "@/components/ui/PlayerCell";
import { EmptyWatchlistMessage } from "@/components/ui/PlayerListFilter";
import WatchlistStar from "@/components/ui/WatchlistStar";
import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { availabilityFor } from "@/lib/availability";
import { calculateCashCowRows } from "@/lib/cashcows";
import { formatChange, formatMoney } from "@/lib/format";
import { useMatchupSetting } from "@/lib/fixtureDifficulty/useMatchupSetting";
import { useLiveRoundContext } from "@/lib/liveMatch/useLiveRoundContext";
import { playerRepository } from "@/lib/repository/PlayerRepository";
import { useWatchlist } from "@/lib/watchlist/useWatchlist";
import { WATCHLIST_FULL_MESSAGE, WATCHLIST_MAX } from "@/lib/watchlist/watchlist";
import type { Player } from "@/types/player";

const players = playerRepository.getAll();
const PLAYERS_BY_ID = new Map(players.map((player) => [player.id, player]));
const PLAYER_IDS: ReadonlySet<number> = new Set(PLAYERS_BY_ID.keys());

type WatchRow = {
  player: Player;
  rise1: number | null;
  rise3: number | null;
  peakGain: number | null;
  peakRound: number | null;
};

const gainColour = (value: number | null) =>
  value === null || value === 0 ? "text-slate-400" : value > 0 ? "text-emerald-400" : "text-red-400";

const gain = (value: number | null) => (value === null ? "-" : formatChange(value));

/**
 * The My Team page's Watchlist tab: each watched player's price, BE and
 * projected price changes, from the same calculation as Cash Cows
 * (Projected mode with the shared matchup switch, no overrides).
 */
export default function WatchlistTable() {
  const watchlist = useWatchlist(PLAYER_IDS);
  const { contexts } = useLiveRoundContext();
  // The same shared switch as Cash Cows and the Projector.
  const [matchupOn] = useMatchupSetting();

  const rows = useMemo<WatchRow[]>(() => {
    const watched = watchlist.entries
      .map((entry) => PLAYERS_BY_ID.get(entry.id))
      .filter((player): player is Player => player !== undefined);
    // Players without enough scores have no projection: shown with "-".
    const projections = new Map(
      calculateCashCowRows(watched, "projected", {}, contexts, { matchup: matchupOn }).map((row) => [
        row.player.id,
        row,
      ]),
    );

    return watched.map((player) => {
      const row = projections.get(player.id);
      return {
        player,
        rise1: row?.rise1 ?? null,
        rise3: row?.rise3 ?? null,
        peakGain: row?.toppedOutGain ?? null,
        peakRound: row?.toppedOutRound ?? null,
      };
    });
  }, [watchlist.entries, contexts, matchupOn]);

  const columns: DataTableColumn<WatchRow>[] = [
    {
      id: "player",
      header: "Player",
      width: { base: 174, sm: 200 },
      sortValue: (row) => row.player.name,
      firstSortDirection: "asc",
      cell: ({ player }) => (
        <PlayerCell
          name={player.name}
          team={player.team}
          positions={player.positions}
          href={`/projector?player=${player.id}`}
          leading={<WatchlistStar playerId={player.id} playerName={player.name} watchlist={watchlist} />}
          trailing={<AvailabilityBadge info={availabilityFor(player, CURRENT_COMPLETED_ROUND + 1)} />}
        />
      ),
    },
    {
      id: "price",
      header: "Price",
      width: 92,
      align: "right",
      pinFrom: "sm",
      sortValue: (row) => row.player.price,
      cell: (row) => formatMoney(row.player.price),
    },
    {
      id: "breakeven",
      header: "BE",
      width: 56,
      align: "right",
      sortValue: (row) => row.player.breakeven,
      firstSortDirection: "asc",
      cell: (row) => row.player.breakeven,
      cellClassName: () => "text-slate-300",
    },
    {
      id: "rise1",
      header: "+1R",
      info: "Price change after the next round.",
      width: 80,
      align: "right",
      sortValue: (row) => row.rise1,
      cell: (row) => gain(row.rise1),
      cellClassName: (row) => `font-semibold ${gainColour(row.rise1)}`,
    },
    {
      id: "rise3",
      header: "+3R",
      info: "Price change over the next 3 rounds.",
      width: 80,
      align: "right",
      sortValue: (row) => row.rise3,
      cell: (row) => gain(row.rise3),
      cellClassName: (row) => `font-semibold ${gainColour(row.rise3)}`,
    },
    {
      id: "peakGain",
      header: "Peak gain",
      info: "Total price rise from now until the price stops rising, using the projected scores.",
      width: 112,
      align: "right",
      sortValue: (row) => row.peakGain,
      cell: (row) => gain(row.peakGain),
      cellClassName: (row) => `font-semibold ${gainColour(row.peakGain)}`,
    },
    {
      id: "peakRound",
      header: "Peak Rd",
      info: "The round the price stops rising.",
      width: 96,
      align: "right",
      sortValue: (row) => row.peakRound,
      firstSortDirection: "asc",
      cell: (row) => (row.peakRound === null ? "-" : `R${row.peakRound}`),
      cellClassName: () => "text-slate-300",
    },
  ];

  return (
    <section aria-label="Watchlist" className="space-y-4">
      {/* Players are added with the star in Cash Cows and the Price Projector. */}
      <p className="text-xs text-slate-400">
        {watchlist.count} of {WATCHLIST_MAX} players. Saved in this browser only. Add players with the
        star in Cash Cows or the Price Projector.
        {watchlist.isFull && <span className="block text-amber-200">{WATCHLIST_FULL_MESSAGE}</span>}
      </p>

      <DataTable
        caption="Your watchlist"
        rows={rows}
        columns={columns}
        rowKey={(row) => row.player.id}
        defaultSort={{ columnId: "peakGain", direction: "desc" }}
        singleLineHeaders
        empty={<EmptyWatchlistMessage />}
      />
    </section>
  );
}
