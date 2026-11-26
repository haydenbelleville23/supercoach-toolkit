"use client";

import { useId, useState } from "react";

import { formatMoney } from "@/lib/format";
import { getAddTradeState, type RoundSummary } from "@/lib/planner/evaluatePlan";
import { BEST_SCORES_IN_BYE_ROUND } from "@/lib/rules/squadRules";
import { buildFieldLayout } from "@/lib/planner/fieldLayout";
import { isPlaceholderId } from "@/lib/planner/placeholders";
import {
  parsePriceInput,
  setTradePriceOverride,
  updateTrade,
} from "@/lib/planner/tradePrices";
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
  onChange: (next: PlanRound) => void;
  onToggleCollapsed: () => void;
  onToggleField: () => void;
  onNewRookie: (tradeIndex: number, position: Position) => void;
  onPlaceholderTeam: (placeholderId: number, team: string | null) => void;
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
  onChange,
  onToggleField,
  onNewRookie,
  onPlaceholderTeam,
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

  // Changing a player drops that row's price overrides (updateTrade).
  const setTrade = (index: number, change: Partial<PlanRound["trades"][number]>) =>
    onChange({
      ...planRound,
      trades: planRound.trades.map((t, i) => (i === index ? updateTrade(t, change) : t)),
    });

  const setPrice = (index: number, side: "out" | "in", price: number | null) =>
    onChange({
      ...planRound,
      trades: planRound.trades.map((t, i) =>
        i === index ? setTradePriceOverride(t, side, price) : t,
      ),
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
                  <TradePrice
                    side="out"
                    label={`Round ${summary.round} trade ${index + 1}: price out`}
                    price={line.outPrice}
                    defaultPrice={line.outDefault}
                    overridden={trade.outPriceOverride !== undefined}
                    placeholder={isPlaceholderId(trade.outId)}
                    onSet={(price) => setPrice(index, "out", price)}
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
                  <TradePrice
                    side="in"
                    label={`Round ${summary.round} trade ${index + 1}: price in`}
                    price={line.inPrice}
                    defaultPrice={line.inDefault}
                    overridden={trade.inPriceOverride !== undefined}
                    placeholder={isPlaceholderId(trade.inId)}
                    onSet={(price) => setPrice(index, "in", price)}
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
        {summary.byeTeams.length > 0 &&
          ` · best ${BEST_SCORES_IN_BYE_ROUND} scores count this round`}
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
 * A trade row's price for this trade only. Tap it to type an override
 * (e.g. 350000, 350,000, $350k); Done applies it, Reset returns to the
 * default. Overrides change this trade's cash, never the engine's prices.
 */
function TradePrice({
  side,
  label,
  price,
  defaultPrice,
  overridden,
  placeholder,
  onSet,
}: {
  side: "in" | "out";
  label: string;
  price: number;
  defaultPrice: number | null;
  overridden: boolean;
  placeholder: boolean;
  onSet: (price: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const colour = overridden
    ? "text-amber-300"
    : side === "out"
      ? "text-red-300"
      : "text-emerald-300";

  const defaultLabel =
    defaultPrice === null ? "no default price" : `Default ${formatMoney(defaultPrice)}`;

  function open() {
    setText(String(price));
    setError(null);
    setEditing(true);
  }

  function apply() {
    const result = parsePriceInput(text);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    // Typing the default back is the same as no override.
    onSet(result.price === defaultPrice ? null : result.price);
    setEditing(false);
  }

  return (
    <div className="mt-1 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => (editing ? setEditing(false) : open())}
          aria-expanded={editing}
          aria-label={`${label}: ${formatMoney(price)}${overridden ? ` (typed; ${defaultLabel})` : ""}. Tap to change.`}
          title={overridden ? `Typed price. ${defaultLabel}.` : "Tap to type a price for this trade"}
          className={`inline-flex min-h-8 items-center gap-1 rounded tabular-nums underline decoration-dotted underline-offset-2 ${colour}`}
        >
          {side === "out" ? "Out" : "In"} {formatMoney(price)}
          {overridden && (
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-300" />
          )}
        </button>

        {placeholder && (
          <span className="rounded bg-violet-500/30 px-1 font-bold text-violet-100">TBC</span>
        )}

        {overridden && !editing && (
          <span className="text-slate-400">{defaultLabel}</span>
        )}
      </div>

      {editing && (
        <div className="mt-1.5 rounded-lg border border-slate-700 bg-slate-900 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              aria-label={label}
              aria-invalid={error !== null}
              aria-describedby={error ? errorId : undefined}
              value={text}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  apply();
                }
                if (e.key === "Escape") {
                  setEditing(false);
                }
              }}
              className="h-10 w-28 rounded-md border border-slate-600 bg-slate-950 px-2 text-right text-sm tabular-nums text-white outline-none focus:border-violet-500"
            />

            <button
              type="button"
              onClick={apply}
              className="h-10 rounded-md bg-violet-500 px-3 text-xs font-semibold text-white"
            >
              Done
            </button>

            <button
              type="button"
              disabled={!overridden}
              onClick={() => {
                onSet(null);
                setEditing(false);
              }}
              className="h-10 rounded-md border border-slate-600 px-3 text-xs font-semibold text-slate-200 disabled:opacity-40"
            >
              Reset
            </button>
          </div>

          <p className="mt-1 text-slate-400">
            {defaultLabel}. This trade only.
          </p>

          {error && (
            <p id={errorId} role="alert" className="mt-1 text-red-300">
              {error}
            </p>
          )}
        </div>
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
