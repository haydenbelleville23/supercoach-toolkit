"use client";

import { formatMoney } from "@/lib/format";
import type { RoundSummary } from "@/lib/planner/evaluatePlan";
import type { PlanRound } from "@/lib/planner/types";

import type { Player } from "@/types/player";

import PlayerPicker from "./PlayerPicker";

export default function RoundCard({
  summary,
  planRound,
  squadBefore,
  playersById,
  playersByLabel,
  listId,
  onChange,
}: {
  summary: RoundSummary;
  planRound: PlanRound;
  /** Squad going into this round (before its trades). */
  squadBefore: number[];
  playersById: Map<number, Player>;
  playersByLabel: Map<string, Player>;
  listId: string;
  onChange: (next: PlanRound) => void;
}) {
  const squadOptions = squadBefore
    .map((id) => playersById.get(id))
    .filter((p): p is Player => !!p)
    .sort((a, b) => a.name.localeCompare(b.name));

  const setTrade = (index: number, change: Partial<PlanRound["trades"][number]>) =>
    onChange({
      ...planRound,
      trades: planRound.trades.map((t, i) => (i === index ? { ...t, ...change } : t)),
    });

  const overLimit = summary.tradesUsed > summary.tradeLimit;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          Round {summary.round}
          {summary.byeTeams.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
              Bye round
            </span>
          )}
        </h2>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={planRound.boost}
            disabled={!planRound.boost && summary.boostsLeftBefore <= 0}
            onChange={(e) => onChange({ ...planRound, boost: e.target.checked })}
            className="h-4 w-4 accent-violet-500"
          />
          Use a boost (+1 trade)
        </label>
      </div>

      {/* Trades */}
      <div className="mt-3 space-y-2">
        {planRound.trades.map((trade, index) => {
          const line = summary.trades[index];

          return (
            <div
              key={index}
              className="grid grid-cols-1 gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-2.5 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
            >
              <div>
                <select
                  aria-label={`Round ${summary.round} trade ${index + 1}: player out`}
                  value={trade.outId ?? ""}
                  onChange={(e) =>
                    setTrade(index, { outId: e.target.value ? Number(e.target.value) : null })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm"
                >
                  <option value="">Player out…</option>
                  {trade.outId !== null && !squadBefore.includes(trade.outId) && (
                    <option value={trade.outId}>
                      {playersById.get(trade.outId)?.name ?? trade.outId} (not in squad)
                    </option>
                  )}
                  {squadOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.positions.join("/")})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs tabular-nums text-red-300">
                  {line?.outPrice != null ? `Out ${formatMoney(line.outPrice)}` : " "}
                </p>
              </div>

              <div>
                <PlayerPicker
                  key={`${summary.round}-${index}-${trade.inId ?? "none"}`}
                  listId={listId}
                  label={`Round ${summary.round} trade ${index + 1}: player in`}
                  players={playersByLabel}
                  selected={trade.inId === null ? null : playersById.get(trade.inId) ?? null}
                  onSelect={(inId) => setTrade(index, { inId })}
                />
                <p className="mt-1 text-xs tabular-nums text-emerald-300">
                  {line?.inPrice != null ? `In ${formatMoney(line.inPrice)}` : " "}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  onChange({ ...planRound, trades: planRound.trades.filter((_, i) => i !== index) })
                }
                className="justify-self-start rounded-lg border border-slate-700 px-2.5 py-2 text-xs text-slate-300 hover:text-white"
                aria-label={`Remove round ${summary.round} trade ${index + 1}`}
              >
                Remove
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() =>
            onChange({ ...planRound, trades: [...planRound.trades, { outId: null, inId: null }] })
          }
          className="rounded-lg border border-violet-500/50 px-3 py-1.5 text-xs font-semibold text-violet-200"
        >
          + Add trade
        </button>
      </div>

      {/* Carry-forward summary */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <Stat
          label="Trades"
          value={`${summary.tradesUsed} / ${summary.tradeLimit}`}
          tone={overLimit ? "bad" : undefined}
        />
        <Stat label="Players out" value={formatMoney(summary.outTotal)} />
        <Stat label="Players in" value={formatMoney(summary.inTotal)} />
        <Stat
          label="Cash in bank"
          value={formatMoney(summary.cashAfter)}
          detail={`was ${formatMoney(summary.cashBefore)}`}
          tone={summary.cashAfter < 0 ? "bad" : undefined}
        />
        <Stat label="Squad value" value={formatMoney(summary.squadValue)} />
        <Stat label="Team value" value={formatMoney(summary.squadValue + summary.cashAfter)} />
        <Stat
          label="Trades left"
          value={String(summary.tradesLeftAfter)}
          tone={summary.tradesLeftAfter < 0 ? "bad" : undefined}
        />
        <Stat label="Boosts left" value={String(summary.boostsLeftAfter)} />
      </dl>

      {/* Byes */}
      <p className="mt-3 text-xs text-slate-400">
        {summary.byeTeams.length > 0 ? `On bye: ${summary.byeTeams.join(", ")}. ` : "No byes. "}
        Squad on bye: {summary.onBye} · Playing: {summary.playing} (on field{" "}
        {summary.onFieldPlaying}/{summary.onFieldNeeded})
      </p>

      {summary.warnings.length > 0 && (
        <ul
          role="status"
          className="mt-3 list-disc space-y-1 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2 pl-7 pr-3 text-xs text-amber-100"
        >
          {summary.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "bad";
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`font-semibold tabular-nums ${tone === "bad" ? "text-red-300" : "text-white"}`}>
        {value}
        {detail && <span className="ml-1 text-xs font-normal text-slate-400">{detail}</span>}
      </dd>
    </div>
  );
}
