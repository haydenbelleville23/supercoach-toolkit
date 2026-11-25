"use client";

import { Fragment, useState } from "react";

import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { formatChange, formatMoney } from "@/lib/format";
import type { SeasonProjectionRow } from "@/types/projection";

const QUICK_SCORES = [50, 80, 100, 120];

type SeasonProjectionTableProps = {
  rows: SeasonProjectionRow[];
  startingPrice: number;
  onScoreChange: (round: number, score: number | null) => void;
};

export default function SeasonProjectionTable({
  rows,
  startingPrice,
  onScoreChange,
}: SeasonProjectionTableProps) {
  const [showEarlierRounds, setShowEarlierRounds] = useState(false);

  // Round whose quick score buttons are showing (its score box is focused).
  const [quickScoreRound, setQuickScoreRound] =
    useState<number | null>(null);

  function closeQuickScoresUnlessMovingTo(
    nextFocus: EventTarget | null,
    round: number,
  ) {
    const next =
      nextFocus instanceof HTMLElement ? nextFocus : null;

    const stayingInRound =
      next?.id === `round-${round}-score` ||
      next?.closest(`[data-quick-scores="${round}"]`) !== null;

    if (!next || !stayingInRound) {
      setQuickScoreRound((current) =>
        current === round ? null : current,
      );
    }
  }

  const firstVisibleRound = CURRENT_COMPLETED_ROUND;

  const visibleRows = showEarlierRounds
    ? rows
    : rows.filter((row) => row.round >= firstVisibleRound);

  const openingPrice =
    rows.find((row) => row.round === 0)?.price ??
    startingPrice;

  const futureRows = rows.filter(
    (row) => row.round > CURRENT_COMPLETED_ROUND,
  );

  // Edge states explained under the table.
  const hasPriceLockedRounds = futureRows.some(
    (row) =>
      row.score !== null && row.breakEven === null,
  );

  const hasBlankRounds = futureRows.some(
    (row) => row.score === null,
  );

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
        <table className="w-full min-w-[560px] table-fixed whitespace-nowrap text-xs sm:text-sm">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
            <col className="w-[18%]" />
            <col className="w-[20%]" />
          </colgroup>

          <thead className="bg-slate-950 text-slate-400">
            <tr>
              {/* Rd stays pinned while the table scrolls on phones. */}
              <th className="sticky left-0 z-10 bg-slate-950 px-1.5 py-3 sm:px-2 text-center shadow-[4px_0_6px_rgba(0,0,0,0.2)]">
                Rd
              </th>

              <th className="px-1.5 py-3 sm:px-2 text-right">
                Score
              </th>

              <th className="px-1.5 py-3 sm:px-2 text-right">
                Price
              </th>

              <th className="px-1.5 py-3 sm:px-2 text-right">
                BE
              </th>

              <th className="px-1.5 py-3 sm:px-2 text-right">
                Δ Rd
              </th>

              <th className="px-1.5 py-3 sm:px-2 text-right">
                Δ Season
              </th>
            </tr>
          </thead>

          <tbody>
            {visibleRows.map((row) => {
              const isFuture =
                row.round > CURRENT_COMPLETED_ROUND;

              const seasonPriceChange =
                row.price === null
                  ? null
                  : row.price - openingPrice;

              const showQuickScores =
                isFuture && quickScoreRound === row.round;

              return (
                <Fragment key={row.round}>
                <tr
                  className={`border-t border-slate-800 transition-colors ${
                    isFuture
                      ? "bg-slate-900 hover:bg-slate-800"
                      : "bg-slate-950/40 text-slate-400"
                  }`}
                >
                  <td
                    className={`sticky left-0 z-10 px-2 py-2 text-center shadow-[4px_0_6px_rgba(0,0,0,0.2)] ${
                      isFuture ? "bg-slate-900" : "bg-slate-950"
                    }`}
                  >
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
                      <div className="mt-0.5 whitespace-nowrap text-xs text-slate-400">
                        vs {row.opponent} ({row.homeAway})
                      </div>
                    ) : (
                      <div className="mt-0.5 text-xs font-medium text-slate-400">
                        BYE
                      </div>
                    )}
                  </td>

                  <td className="px-1.5 py-2.5 sm:px-2 text-right">
                    {isFuture ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Round ${row.round} score`}
                        value={row.score ?? ""}
                        placeholder="-"
                        id={`round-${row.round}-score`}
                        aria-describedby={
                          showQuickScores
                            ? `round-${row.round}-quick-scores`
                            : undefined
                        }
                        onFocus={(event) => {
                          event.currentTarget.select();
                          setQuickScoreRound(row.round);
                        }}
                        onBlur={(event) =>
                          closeQuickScoresUnlessMovingTo(
                            event.relatedTarget,
                            row.round,
                          )
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

                    {/* Price */}
                    <td className="px-1.5 py-2.5 sm:px-2 text-right font-semibold tabular-nums">
                      {row.price === null ? "-" : formatMoney(row.price)}
                    </td>

                  <td className="px-1.5 py-2.5 sm:px-2 text-right tabular-nums text-slate-400">
                    {row.breakEven === null
                      ? "-"
                      : Math.ceil(row.breakEven)}
                  </td>

                    {/* Round price change */}
                    <td
                     className={`px-1.5 py-2.5 sm:px-2 text-right tabular-nums ${
                      row.priceChange === null || row.priceChange === 0
                        ? "text-slate-400"
                        : row.priceChange > 0
                          ? "text-emerald-400"
                          : "text-red-400"
                    }`}
                  >
                    {formatChange(row.priceChange)}
                    </td>

                    {/* Season price change */}
                    <td
                      className={`px-1.5 py-2.5 sm:px-2 text-right tabular-nums ${
                        seasonPriceChange === null || seasonPriceChange === 0
                          ? "text-slate-400"
                          : seasonPriceChange > 0
                            ? "text-emerald-400"
                            : "text-red-400"
                      }`}
                    >
                    {formatChange(seasonPriceChange)}
                    </td>
                </tr>

                {showQuickScores && (
                  <tr className="bg-slate-900">
                    <td colSpan={6} className="px-2 pb-2.5">
                      {/* Sticky so the buttons stay in view on a scrolled phone table. */}
                      <div
                        id={`round-${row.round}-quick-scores`}
                        role="group"
                        aria-label={`Quick scores for round ${row.round}`}
                        data-quick-scores={row.round}
                        onBlur={(event) =>
                          closeQuickScoresUnlessMovingTo(
                            event.relatedTarget,
                            row.round,
                          )
                        }
                        className="sticky left-0 flex w-max items-center gap-2"
                      >
                        <span className="text-xs text-slate-400">
                          Quick:
                        </span>

                        {QUICK_SCORES.map((score) => (
                          <button
                            key={score}
                            type="button"
                            aria-label={`Set round ${row.round} score to ${score}`}
                            aria-pressed={row.score === score}
                            // Keep focus in the score box when tapped.
                            onMouseDown={(event) =>
                              event.preventDefault()
                            }
                            onClick={() =>
                              onScoreChange(row.round, score)
                            }
                            className={`min-w-11 rounded-md border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                              row.score === score
                                ? "border-violet-500 bg-violet-500/20 text-violet-200"
                                : "border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500"
                            }`}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {(hasPriceLockedRounds || hasBlankRounds) && (
        <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-400">
          {hasPriceLockedRounds && (
            <li>
              Prices only start changing after a
              player&apos;s third game, so BE shows
              &ldquo;-&rdquo; until then.
            </li>
          )}

          {hasBlankRounds && (
            <li>
              Rounds left blank count as missed
              games: the price stays the same.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}