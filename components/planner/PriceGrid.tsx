"use client";

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

      <div className="max-h-[70vh] overflow-auto">
        <table className="w-max min-w-full whitespace-nowrap text-xs">
          <thead className="sticky top-0 z-20 bg-slate-950 text-slate-400">
            <tr>
              <th className="sticky left-0 z-30 bg-slate-950 px-3 py-2 text-left">Player</th>
              {rounds.map((round) => (
                <th key={round} className="px-2 py-2 text-right">
                  R{round}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {players.map((player) => {
              const path = projector.getPath(player.id);

              return (
                <tr key={player.id} className="border-t border-slate-800">
                  <td className="sticky left-0 z-10 bg-slate-900 px-3 py-1.5">
                    <div className="max-w-[9rem] truncate font-semibold text-white">{player.name}</div>
                    <div className="text-slate-400">
                      {player.team} · {player.positions.join("/")}
                    </div>
                  </td>

                  {path.filter((cell) => cell.round <= lastRound).map((cell) => {
                    const overridden = overrides[player.id]?.[cell.round] !== undefined;

                    return (
                      <td key={cell.round} className="px-2 py-1.5 text-right align-top">
                        <div className="font-semibold tabular-nums text-white">
                          {formatMoney(cell.priceBefore)}
                        </div>

                        {cell.onBye ? (
                          <div className="mt-1 text-slate-400">BYE</div>
                        ) : (
                          <input
                            type="text"
                            inputMode="numeric"
                            aria-label={`${player.name} round ${cell.round} score`}
                            value={
                              overridden
                                ? String(overrides[player.id][cell.round])
                                : cell.score === null
                                  ? ""
                                  : String(Math.round(cell.score))
                            }
                            placeholder="-"
                            onChange={(e) => {
                              const clean = e.target.value.replace(/[^0-9]/g, "");
                              onOverride(player.id, cell.round, clean === "" ? null : Number(clean));
                            }}
                            className={`mt-1 w-12 rounded border px-1.5 py-0.5 text-right tabular-nums outline-none ${
                              overridden
                                ? "border-violet-500 bg-violet-500/15 text-violet-200"
                                : "border-slate-700 bg-slate-950 text-slate-300"
                            }`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
