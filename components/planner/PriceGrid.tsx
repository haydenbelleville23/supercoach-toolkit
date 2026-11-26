"use client";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import PlayerCell from "@/components/ui/PlayerCell";
import { formatMoney } from "@/lib/format";
import type { PriceProjector } from "@/lib/planner/pricePaths";

import type { Player } from "@/types/player";

/**
 * Price before each round (the price a trade that round uses) and the
 * projected score for every player in the plan. Scores can be overridden;
 * overridden values are highlighted and feed the price engine.
 */
export default function PriceGrid({
  players,
  projector,
  lastRound,
  overrides,
  onOverride,
  onReset,
}: {
  players: Player[];
  projector: PriceProjector;
  /** Last round shown in the plan. */
  lastRound: number;
  overrides: Record<number, Record<number, number>>;
  onOverride: (playerId: number, round: number, score: number | null) => void;
  onReset: () => void;
}) {
  const rounds = Array.from(
    { length: lastRound - projector.firstRound + 1 },
    (_, i) => projector.firstRound + i,
  );

  const overrideCount = Object.values(overrides).reduce(
    (total, byRound) => total + Object.keys(byRound).length,
    0,
  );

  const columns: DataTableColumn<Player>[] = [
    {
      id: "player",
      header: "Player",
      width: { base: 124, sm: 160 },
      cell: (player) => (
        <PlayerCell name={player.name} team={player.team} positions={player.positions} />
      ),
    },
    ...rounds.map(
      (round): DataTableColumn<Player> => ({
        id: `round-${round}`,
        header: `R${round}`,
        width: 76,
        align: "right",
        cell: (player) => {
          const cell = projector.getPath(player.id).find((item) => item.round === round);

          if (!cell) {
            return <span className="text-slate-400">-</span>;
          }

          const overridden = overrides[player.id]?.[round] !== undefined;

          return (
            <>
              <div className="text-xs font-semibold text-white">
                {formatMoney(cell.priceBefore)}
              </div>

              {cell.onBye ? (
                <div className="mt-0.5 text-xs text-slate-400">BYE</div>
              ) : (
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`${player.name} round ${round} score`}
                  value={
                    overridden
                      ? String(overrides[player.id][round])
                      : cell.score === null
                        ? ""
                        : String(Math.round(cell.score))
                  }
                  placeholder="-"
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, "");
                    onOverride(player.id, round, clean === "" ? null : Number(clean));
                  }}
                  className={`mt-0.5 w-12 rounded border px-1.5 py-0.5 text-right text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                    overridden
                      ? "border-violet-500 bg-violet-500/15 text-violet-200"
                      : "border-slate-700 bg-slate-950 text-slate-300"
                  }`}
                />
              )}
            </>
          );
        },
      }),
    ),
  ];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900">
      <div className="px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Projected scores</h2>
          <button
            type="button"
            disabled={overrideCount === 0}
            onClick={() => {
              if (window.confirm("Clear every score override in this plan?")) {
                onReset();
              }
            }}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-40"
          >
            Reset overrides{overrideCount > 0 ? ` (${overrideCount})` : ""}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Players in the squad or in trades. Scores default to the season average; type a
          score to override it (highlighted). Overrides feed the price engine, so later prices
          update. Price shown is before the round&apos;s games. Rookie placeholders have no
          scores and are not listed.
        </p>
      </div>

      <div className="px-2 pb-2 sm:px-3 sm:pb-3">
        <DataTable
          caption="Projected price and score by round for players in the plan"
          rows={players}
          columns={columns}
          rowKey={(player) => player.id}
          empty="No players in this plan yet."
        />
      </div>
    </section>
  );
}
