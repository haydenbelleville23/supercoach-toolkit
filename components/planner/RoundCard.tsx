"use client";

import { useState } from "react";

import { formatMoney } from "@/lib/format";
import { getAddTradeState, type RoundSummary } from "@/lib/planner/evaluatePlan";
import { buildFieldLayout } from "@/lib/planner/fieldLayout";
import { isPlaceholderId } from "@/lib/planner/placeholders";
import type { RoundProjection } from "@/lib/planner/pricePaths";
import type { PlanRound, RookiePlaceholder } from "@/lib/planner/types";
import type { Position } from "@/lib/rules/squadRules";

import type { Player } from "@/types/player";

import FieldDiagram from "./FieldDiagram";
import PlayerPicker from "./PlayerPicker";
import { plannerTeams } from "./plannerData";

export interface RoundCardProps {
  summary: RoundSummary;
  planRound: PlanRound;
  /** Squad going into this round (before its trades). */
  squadBefore: number[];
  playersById: Map<number, Player>;
  playersByLabel: Map<string, Player>;
  placeholders: RookiePlaceholder[];
  listId: string;
  collapsed: boolean;
  fieldOpen: boolean;
  /** This round's projection for a player (score, override, bye). */
  getProjection: (playerId: number) => RoundProjection | undefined;
  onChange: (next: PlanRound) => void;
  onToggleCollapsed: () => void;
  onToggleField: () => void;
  onNewRookie: (tradeIndex: number, position: Position) => void;
  onPlaceholderTeam: (placeholderId: number, team: string | null) => void;
  onOverride: (playerId: number, score: number | null) => void;
}

export default function RoundCard(props: RoundCardProps) {
  const { summary, planRound, collapsed } = props;
  const addState = getAddTradeState(summary);
  const overLimit = summary.tradesUsed > summary.tradeLimit;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={props.onToggleCollapsed}
          aria-expanded={!collapsed}
          className="flex items-center gap-2 text-left text-lg font-semibold"
        >
          <span aria-hidden="true" className="text-sm text-slate-400">
            {collapsed ? "▶" : "▼"}
          </span>
          Round {summary.round}
          {summary.byeTeams.length > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
              Bye round
            </span>
          )}
        </button>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={planRound.boost}
            disabled={!planRound.boost && summary.boostsLeftBefore <= 0}
            onChange={(e) => props.onChange({ ...planRound, boost: e.target.checked })}
            className="h-4 w-4 accent-violet-500"
          />
          Boost (+1 trade)
          {!planRound.boost && summary.boostsLeftBefore <= 0 && (
            <span className="text-xs text-slate-400">none left</span>
          )}
        </label>
      </div>

      {collapsed ? (
        <p className="mt-2 text-xs text-slate-400">
          Trades {summary.tradesUsed}/{summary.tradeLimit} · Cash {formatMoney(summary.cashAfter)} ·
          Trades left {summary.tradesLeftAfter}
          {summary.warnings.length > 0 && (
            <span className="ml-1 font-semibold text-amber-300">
              · {summary.warnings.length} warning{summary.warnings.length === 1 ? "" : "s"}
            </span>
          )}
        </p>
      ) : (
        <RoundBody {...props} addState={addState} overLimit={overLimit} />
      )}
    </section>
  );
}

function RoundBody({
  summary,
  planRound,
  squadBefore,
  playersById,
  playersByLabel,
  placeholders,
  listId,
  fieldOpen,
  getProjection,
  onChange,
  onToggleField,
  onNewRookie,
  onPlaceholderTeam,
  onOverride,
  addState,
  overLimit,
}: RoundCardProps & {
  addState: ReturnType<typeof getAddTradeState>;
  overLimit: boolean;
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

  return (
    <>
      {/* Trades */}
      <div className="mt-3 space-y-2">
        {planRound.trades.map((trade, index) => {
          const line = summary.trades[index];
          const inPlaceholder = placeholders.find((p) => p.id === trade.inId);

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
                      {p.name}
                      {isPlaceholderId(p.id) ? "" : ` (${p.positions.join("/")})`}
                    </option>
                  ))}
                </select>

                {trade.outId !== null && line?.outPrice != null && (
                  <PriceTap
                    tone="out"
                    price={line.outPrice}
                    playerId={trade.outId}
                    round={summary.round}
                    projection={getProjection(trade.outId)}
                    onOverride={onOverride}
                  />
                )}
              </div>

              <div>
                <PlayerPicker
                  key={`${summary.round}-${index}-${trade.inId ?? "none"}`}
                  listId={listId}
                  label={`Round ${summary.round} trade ${index + 1}: player in`}
                  players={playersByLabel}
                  selected={trade.inId === null ? null : playersById.get(trade.inId) ?? null}
                  onSelect={(inId) => setTrade(index, { inId })}
                  onNewRookie={(position) => onNewRookie(index, position)}
                />

                {inPlaceholder && (
                  <label className="mt-1 flex items-center gap-1.5 text-xs text-violet-200">
                    <span className="rounded bg-violet-500/30 px-1 font-bold">TBC</span>
                    Team
                    <select
                      value={inPlaceholder.team ?? ""}
                      onChange={(e) => onPlaceholderTeam(inPlaceholder.id, e.target.value || null)}
                      className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs text-slate-200"
                    >
                      <option value="">None (no bye)</option>
                      {plannerTeams.map((team) => (
                        <option key={team} value={team}>
                          {team}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {trade.inId !== null && line?.inPrice != null && (
                  <PriceTap
                    tone="in"
                    price={line.inPrice}
                    playerId={trade.inId}
                    round={summary.round}
                    projection={getProjection(trade.inId)}
                    onOverride={onOverride}
                  />
                )}
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={addState.disabled}
            title={addState.reason ?? undefined}
            onClick={() =>
              onChange({ ...planRound, trades: [...planRound.trades, { outId: null, inId: null }] })
            }
            className="rounded-lg border border-violet-500/50 px-3 py-1.5 text-xs font-semibold text-violet-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
          >
            + Add trade
          </button>

          {addState.reason && (
            <span className="text-xs text-slate-400">{addState.reason}</span>
          )}
        </div>
      </div>

      {/* Carry-forward summary */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <Stat label="Trades" value={`${summary.tradesUsed} / ${summary.tradeLimit}`} tone={overLimit ? "bad" : undefined} />
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
        <Stat label="Trades left" value={String(summary.tradesLeftAfter)} tone={summary.tradesLeftAfter < 0 ? "bad" : undefined} />
        <Stat label="Boosts left" value={String(summary.boostsLeftAfter)} />
      </dl>

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

      {/* Field */}
      <div className="mt-3">
        <button
          type="button"
          onClick={onToggleField}
          aria-expanded={fieldOpen}
          className="text-xs font-semibold text-violet-300 hover:text-violet-200"
        >
          {fieldOpen ? "Hide field" : "Show field"}
        </button>

        {fieldOpen && (
          <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <FieldDiagram layout={buildFieldLayout(summary, playersById)} />
          </div>
        )}
      </div>
    </>
  );
}

/**
 * A trade row's price. Tap it to set that player's score for this round;
 * the override feeds the price engine (later rounds update).
 */
function PriceTap({
  tone,
  price,
  playerId,
  round,
  projection,
  onOverride,
}: {
  tone: "in" | "out";
  price: number;
  playerId: number;
  round: number;
  projection: RoundProjection | undefined;
  onOverride: (playerId: number, score: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const canEdit = !isPlaceholderId(playerId) && projection && !projection.onBye;
  const colour = tone === "out" ? "text-red-300" : "text-emerald-300";

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => setEditing((v) => !v)}
        title={canEdit ? "Tap to set this player's score for the round" : undefined}
        className={`tabular-nums ${colour} ${canEdit ? "underline decoration-dotted underline-offset-2" : ""}`}
      >
        {tone === "out" ? "Out" : "In"} {formatMoney(price)}
      </button>

      {isPlaceholderId(playerId) && (
        <span className="rounded bg-violet-500/30 px-1 font-bold text-violet-100">TBC</span>
      )}

      {editing && canEdit && (
        <label className="flex items-center gap-1 text-slate-300">
          R{round} score
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            aria-label={`Round ${round} score`}
            value={
              projection.overridden
                ? String(projection.score)
                : projection.score === null
                  ? ""
                  : String(Math.round(projection.score))
            }
            onChange={(e) => {
              const clean = e.target.value.replace(/[^0-9]/g, "");
              onOverride(playerId, clean === "" ? null : Number(clean));
            }}
            className={`w-14 rounded border px-1.5 py-0.5 text-right tabular-nums ${
              projection.overridden
                ? "border-violet-500 bg-violet-500/15 text-violet-200"
                : "border-slate-700 bg-slate-950"
            }`}
          />
        </label>
      )}
    </div>
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
