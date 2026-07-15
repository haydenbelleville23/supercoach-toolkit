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

  const finalPricedRow = [...rows]
    .reverse()
    .find((row) => row.price !== null);

  const finalPrice = finalPricedRow?.price ?? startingPrice;
  const totalChange = finalPrice - startingPrice;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">
          Season Projection
        </h2>

        {firstVisibleRound > 0 && (
          <button
            type="button"
            onClick={() =>
              setShowEarlierRounds((current) => !current)
            }
            className="text-sm font-semibold text-emerald-400 transition hover:text-emerald-300"
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
        <table className="w-full min-w-[660px] table-fixed text-sm">
          <colgroup>
            <col className="w-[130px]" />
            <col className="w-[80px]" />
            <col className="w-[65px]" />
            <col className="w-[110px]" />
            <col className="w-[95px]" />
            <col className="w-[75px]" />
          </colgroup>

          <thead className="bg-slate-950 text-slate-400">
            <tr>
              <th className="px-2 py-3 text-center">
                Rd
              </th>

              <th className="px-2 py-3 text-right">
                Score
              </th>

              <th className="px-2 py-3 text-right">
                BE
              </th>

              <th className="px-2 py-3 text-right">
                Price
              </th>

              <th className="px-2 py-3 text-right">
                Δ
              </th>

              <th className="px-2 py-3 text-right">
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

                    {row.opponent && row.homeAway && (
                      <div className="mt-0.5 whitespace-nowrap text-xs text-slate-500">
                        vs {row.opponent} ({row.homeAway})
                      </div>
                    )}
                  </td>

                  <td className="px-2 py-2.5 text-right">
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
                        className="w-16 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-right font-semibold tabular-nums outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    ) : (
                      <span className="tabular-nums">
                        {row.score ?? "-"}
                      </span>
                    )}
                  </td>

                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-400">
                    {row.breakEven === null
                      ? "-"
                      : Math.ceil(row.breakEven)}
                  </td>

                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums">
                    {formatMoney(row.price)}
                  </td>

                  <td
                    className={`px-2 py-2.5 text-right tabular-nums ${
                      row.priceChange === null
                        ? "text-slate-500"
                        : positiveChange
                          ? "text-emerald-400"
                          : "text-red-400"
                    }`}
                  >
                    {row.priceChange === null
                      ? "-"
                      : `${
                          positiveChange ? "+" : "−"
                        }${Math.abs(
                          row.priceChange,
                        ).toLocaleString()}`}
                  </td>

                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-500">
                    {row.round === 0
                      ? "-"
                      : row.magicNumber}
                  </td>
                </tr>
              );
            })}

            <tr className="border-t-2 border-emerald-500/50 bg-slate-950">
              <td
                colSpan={3}
                className="px-3 py-4 text-right font-semibold text-slate-300"
              >
                Final price / cash made
              </td>

              <td className="px-2 py-4 text-right text-base font-bold tabular-nums">
                {finalPrice.toLocaleString()}
              </td>

              <td
                className={`px-2 py-4 text-right text-base font-bold tabular-nums ${
                  totalChange >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {totalChange >= 0 ? "+" : "−"}
                {Math.abs(totalChange).toLocaleString()}
              </td>

              <td className="px-2 py-4" />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}