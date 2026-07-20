"use client";

import { useState } from "react";

import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import type { SeasonProjectionRow } from "@/types/projection";

type SeasonProjectionTableProps = {
  rows: SeasonProjectionRow[];
  startingPrice: number;
  onScoreChange: (round: number, score: number | null) => void;
};

function formatMoney(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return value.toLocaleString();
}

export default function SeasonProjectionTable({
  rows,
  startingPrice,
  onScoreChange,
}: SeasonProjectionTableProps) {
  const [showEarlierRounds, setShowEarlierRounds] = useState(false);

  const firstVisibleRound = CURRENT_COMPLETED_ROUND;

  const visibleRows = showEarlierRounds
    ? rows
    : rows.filter((row) => row.round >= firstVisibleRound);

  const openingPrice =
    rows.find((row) => row.round === 0)?.price ??
    startingPrice;

  return (
    <section>
      <div className="mb-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">
          Season Projection
        </h2>

        {firstVisibleRound > 0 && (
          <button
            type="button"
            onClick={() =>
              setShowEarlierRounds((current) => !current)
            }
            className="text-left text-sm font-semibold text-violet-400 transition hover:text-violet-300 sm:text-right"
          >
            {showEarlierRounds
              ? "Hide earlier rounds"
              : `Show earlier rounds (R0–R${
                  firstVisibleRound - 1
                })`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full min-w-[660px] table-fixed text-xs sm:text-sm">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[17%]" />
            <col className="w-[15%]" />
            <col className="w-[18%]" />
            <col className="w-[10%]" />
          </colgroup>

          <thead className="bg-slate-950 text-slate-400">
            <tr>
              <th className="px-1.5 py-3 sm:px-2 text-center">
                Rd
              </th>

              <th className="px-1.5 py-3 sm:px-2 text-right">
                Score
              </th>

              <th className="px-1.5 py-3 sm:px-2 text-right">
                BE
              </th>

              <th className="px-1.5 py-3 sm:px-2 text-right">
                Price
              </th>

              <th className="px-1.5 py-3 sm:px-2 text-right">
                Δ Rd
              </th>

              <th className="px-1.5 py-3 sm:px-2 text-right">
                Δ Season
              </th>

              <th className="px-1.5 py-3 sm:px-2 text-right">
                MN
              </th>
            </tr>
          </thead>

          <tbody>
            {visibleRows.map((row) => {
              const isFuture =
                row.round > CURRENT_COMPLETED_ROUND;

              const positiveChange =
                row.priceChange !== null &&
                row.priceChange >= 0;

                const seasonPriceChange =
                row.price === null
                  ? null
                  : row.price - openingPrice;

              return (
                <tr
                  key={row.round}
                  className={`border-t border-slate-800 transition-colors ${
                    isFuture
                      ? "bg-slate-900 hover:bg-slate-800"
                      : "bg-slate-950/40 text-slate-500"
                  }`}
                >
                  <td className="px-2 py-2 text-center">
                    <div
                      className={
                        isFuture
                          ? "font-semibold text-emerald-400"
                          : "font-semibold"
                      }
                    >
                      R{row.round}
                    </div>

                   {row.opponent && row.homeAway ? (
                      <div className="mt-0.5 whitespace-nowrap text-xs text-slate-500">
                        vs {row.opponent} ({row.homeAway})
                      </div>
                    ) : (
                      <div className="mt-0.5 text-xs font-medium text-slate-500">
                        BYE
                      </div>
                    )}
                  </td>

                  <td className="px-1.5 py-2.5 sm:px-2 text-right">
                    {isFuture ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.score ?? ""}
                        placeholder="-"
                        onFocus={(event) =>
                          event.currentTarget.select()
                        }
                        onChange={(event) => {
                          const cleanedValue =
                            event.target.value.replace(
                              /[^0-9]/g,
                              "",
                            );

                          onScoreChange(
                            row.round,
                            cleanedValue === ""
                              ? null
                              : Number(cleanedValue),
                          );
                        }}
                        className="w-14 rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1 text-right font-semibold tabular-nums outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500 sm:w-16 sm:px-2"
                      />
                    ) : (
                      <span className="tabular-nums">
                        {row.score ?? "-"}
                      </span>
                    )}
                  </td>

                  <td className="px-1.5 py-2.5 sm:px-2 text-right tabular-nums text-slate-400">
                    {row.breakEven === null
                      ? "-"
                      : Math.ceil(row.breakEven)}
                  </td>
                    {/* Price */}
                    <td className="px-1.5 py-2.5 sm:px-2 text-right font-semibold tabular-nums">
                      {row.price === null ? "-" : `$${formatMoney(row.price)}`}
                    </td>

                    {/* Round price change */}
                    <td
                     className={`px-1.5 py-2.5 sm:px-2 text-right tabular-nums ${
                      row.priceChange === null || row.priceChange === 0
                        ? "text-slate-500"
                        : row.priceChange > 0
                          ? "text-emerald-400"
                          : "text-red-400"
                    }`}
                  >
                    {row.priceChange === null || row.priceChange === 0
                      ? "-"
                      : `${row.priceChange > 0 ? "+" : "−"}$${Math.abs(
                          row.priceChange,
                        ).toLocaleString()}`}
                    </td>

                    {/* Season price change */}
                    <td
                      className={`px-1.5 py-2.5 sm:px-2 text-right tabular-nums ${
                        seasonPriceChange === null || seasonPriceChange === 0
                          ? "text-slate-500"
                          : seasonPriceChange > 0
                            ? "text-emerald-400"
                            : "text-red-400"
                      }`}
                    >
                    {seasonPriceChange === null || seasonPriceChange === 0
                      ? "-"
                      : `${seasonPriceChange > 0 ? "+" : "−"}$${Math.abs(
                          seasonPriceChange,
                        ).toLocaleString()}`}
                    </td>

                    {/* Magic Number */}
                  <td className="px-1.5 py-2.5 sm:px-2 text-right tabular-nums text-slate-500">
                    {row.round === 0
                      ? "-"
                      : row.magicNumber}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}