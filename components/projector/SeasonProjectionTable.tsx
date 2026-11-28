"use client";

import { useState } from "react";
import { formatSigned } from "@/lib/fixtureDifficulty/colour";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { formatChange, formatMoney } from "@/lib/format";
import type { SeasonProjectionRow } from "@/types/projection";

const QUICK_SCORES = [50, 80, 100, 120];

type SeasonProjectionTableProps = {
  rows: SeasonProjectionRow[];
  startingPrice: number;
  onScoreChange: (round: number, score: number | null) => void;
};

function changeColour(value: number | null): string {
  return value === null || value === 0
    ? "text-slate-400"
    : value > 0
      ? "text-emerald-400"
      : "text-red-400";
}

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
    (row) => row.played && row.score === null,
  );

  const isFuture = (row: SeasonProjectionRow) =>
    row.round > CURRENT_COMPLETED_ROUND;

  const seasonChange = (row: SeasonProjectionRow) =>
    row.price === null ? null : row.price - openingPrice;

  // Phone widths fit a 375px screen with no sideways scroll; the sm widths
  // are the planned ones.
  const columns: DataTableColumn<SeasonProjectionRow>[] = [
    {
      id: "round",
      header: "Rd",
      width: { base: 50, sm: 64 },
      align: "center",
      cell: (row) => (
        <>
          <div
            className={
              isFuture(row)
                ? "font-semibold text-emerald-400"
                : "font-semibold"
            }
          >
            R{row.round}
          </div>

          {row.opponent && row.homeAway ? (
            <div className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">
              <span className="hidden sm:inline">vs </span>
              {row.opponent} ({row.homeAway})
              {/* The column is narrow, so the matchup adjustment sits on its own line. */}
              {row.matchupAdjustment != null && isFuture(row) && (
                <span
                  className="block text-[10px] tabular-nums text-slate-300 sm:text-[11px]"
                  title={`Matchup adjustment against ${row.opponent}`}
                >
                  {formatSigned(row.matchupAdjustment)}
                </span>
              )}
            </div>
          ) : (
            <div className="mt-0.5 text-[11px] font-medium text-slate-400 sm:text-xs">
              BYE
            </div>
          )}
        </>
      ),
    },
    {
      id: "score",
      header: "Score",
      width: { base: 52, sm: 64 },
      align: "right",
      cell: (row) => {
        if (!isFuture(row)) {
          return row.score ?? "-";
        }

        if (!row.played) {
          return <span className="text-slate-500">-</span>;
        }

        const showQuickScores = quickScoreRound === row.round;

        return (
          <input
            type="text"
            inputMode="numeric"
            aria-label={`Round ${row.round} score${row.edited ? " (edited)" : ""}`}
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
                event.target.value.replace(/[^0-9]/g, "");

              onScoreChange(
                row.round,
                cleanedValue === "" ? null : Number(cleanedValue),
              );
            }}
            title={row.edited ? "Edited: your score. Pick a projection to refill every round." : undefined}
            // Edited rounds look like Cash Cows' edited scores.
            className={`w-11 rounded-md border px-1 py-1 text-right font-semibold tabular-nums outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500 sm:w-12 sm:px-1.5 ${
              row.edited
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                : "border-slate-700 bg-slate-950 text-white"
            }`}
          />
        );
      },
    },
    {
      id: "price",
      header: "Price",
      width: { base: 72, sm: 88 },
      align: "right",
      cell: (row) => (row.price === null ? "-" : formatMoney(row.price)),
      cellClassName: () => "font-semibold",
    },
    {
      id: "breakeven",
      header: "BE",
      width: { base: 38, sm: 52 },
      align: "right",
      cell: (row) =>
        row.breakEven === null ? "-" : Math.ceil(row.breakEven),
      cellClassName: () => "text-slate-400",
    },
    {
      id: "roundChange",
      header: "Δ Rd",
      width: { base: 60, sm: 76 },
      align: "right",
      cell: (row) => formatChange(row.priceChange),
      cellClassName: (row) => changeColour(row.priceChange),
    },
    {
      id: "seasonChange",
      header: "Δ Season",
      width: { base: 64, sm: 84 },
      align: "right",
      cell: (row) => formatChange(seasonChange(row)),
      cellClassName: (row) => changeColour(seasonChange(row)),
    },
  ];

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-200">
          Season projection
        </h2>

        {firstVisibleRound > 0 && (
          <button
            type="button"
            aria-pressed={showEarlierRounds}
            onClick={() =>
              setShowEarlierRounds((current) => !current)
            }
            className="rounded-md px-1.5 py-1 text-xs font-semibold text-violet-400 transition hover:text-violet-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            {showEarlierRounds
              ? "Hide earlier rounds"
              : `Show R0–R${firstVisibleRound - 1}`}
          </button>
        )}
      </div>

      <DataTable
        caption="Season projection by round"
        rows={visibleRows}
        columns={columns}
        rowKey={(row) => row.round}
        compact
        mutedRow={(row) => !isFuture(row)}
        renderExpanded={(row) =>
          isFuture(row) && quickScoreRound === row.round ? (
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
              className="flex w-max items-center gap-2"
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
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onScoreChange(row.round, score)}
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
          ) : null
        }
      />

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
