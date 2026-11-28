"use client";

import { AlertOctagon, AlertTriangle, Info } from "lucide-react";
import { useId, useMemo, useState } from "react";

import InfoPopover from "@/components/ui/InfoPopover";
import PlayerSelect, { type PinnedOption } from "@/components/ui/PlayerSelect";
import { formatMoney } from "@/lib/format";
import { getAddTradeState, type RoundSummary } from "@/lib/planner/evaluatePlan";
import { buildFieldLayout } from "@/lib/planner/fieldLayout";
import { isPlaceholderId } from "@/lib/planner/placeholders";
import {
  parsePriceInput,
  setTradePriceOverride,
  updateTrade,
} from "@/lib/planner/tradePrices";
import { tradeInExclusions, tradeOutCandidates } from "@/lib/planner/tradeOptions";
import type { PlanRound, RookiePlaceholder } from "@/lib/planner/types";
import { groupWarnings, type WarningSeverity } from "@/lib/planner/warningSeverity";
import { useWatchlist } from "@/lib/watchlist/useWatchlist";
import { ROOKIE_PLACEHOLDER, type Position } from "@/lib/rules/squadRules";

import type { Player } from "@/types/player";

import FieldDiagram from "./FieldDiagram";
import { plannerTeams, ROOKIE_OPTIONS } from "./plannerData";

export interface RoundCardProps {
  summary: RoundSummary;
  planRound: PlanRound;
  /** Squad going into this round (before its trades). */
  squadBefore: number[];
  playersById: Map<number, Player>;
  /** Everyone who can be traded in (real players and this team's placeholders). */
  allPlayers: Player[];
  /** A player's price going into a round (the price he's traded at). */
  priceAt: (playerId: number, round: number) => number | null;
  placeholders: RookiePlaceholder[];
  collapsed: boolean;
  fieldOpen: boolean;
  onChange: (next: PlanRound) => void;
  onToggleCollapsed: () => void;
  onToggleField: () => void;
  onNewRookie: (tradeIndex: number, position: Position) => void;
  onPlaceholderTeam: (placeholderId: number, team: string | null) => void;
}

const SEVERITY_LABEL: Record<WarningSeverity, string> = {
  error: "Errors",
  warning: "Warnings",
  info: "Notes",
};

const BADGE_STYLE: Record<WarningSeverity, string> = {
  error: "border-red-400/60 bg-red-500/20 text-red-100",
  warning: "border-amber-400/60 bg-amber-500/15 text-amber-100",
  info: "border-slate-600 bg-slate-800 text-slate-200",
};

const BADGE_ICON = { error: AlertOctagon, warning: AlertTriangle, info: Info };

/**
 * The round's problems as a badge (icon and count) that opens a list by
 * severity. The worst severity sets its colour, so errors show without
 * opening anything; the messages are also in the page for screen readers.
 */
function WarningsBadge({ round, warnings }: { round: number; warnings: string[] }) {
  const groups = groupWarnings(warnings);
  if (groups.length === 0) return null;

  const worst = groups[0].severity;
  const Icon = BADGE_ICON[worst];
  const counts = groups.map((g) => `${g.messages.length} ${g.messages.length === 1 ? SEVERITY_LABEL[g.severity].toLowerCase().replace(/s$/, "") : SEVERITY_LABEL[g.severity].toLowerCase()}`);

  const list = (
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group.severity}>
          <p className="font-semibold text-white">{SEVERITY_LABEL[group.severity]}</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
            {group.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <InfoPopover
        label={`Round ${round} problems: ${counts.join(", ")}`}
        widthRem={20}
        triggerClassName={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-full border px-2 text-xs font-bold tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${BADGE_STYLE[worst]}`}
        trigger={
          <>
            <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
            {warnings.length}
          </>
        }
      >
        {list}
      </InfoPopover>
      {/* The exact messages, always available to screen readers. */}
      <div className="sr-only">
        <p>Round {round} problems</p>
        {list}
      </div>
    </>
  );
}

export default function RoundCard(props: RoundCardProps) {
  const { summary, planRound, collapsed } = props;
  const addState = getAddTradeState(summary);
  const hasErrors = groupWarnings(summary.warnings)[0]?.severity === "error";
  const noBoosts = !planRound.boost && summary.boostsLeftBefore <= 0;

  return (
    <section
      className={`rounded-2xl border bg-slate-900 p-3 sm:p-4 ${hasErrors ? "border-red-500/40" : "border-slate-800"}`}
    >
      <div
        className={`-mx-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-xl px-1 ${
          hasErrors ? "bg-red-500/10" : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={props.onToggleCollapsed}
            aria-expanded={!collapsed}
            className="flex min-h-11 items-center gap-2 text-left text-lg font-semibold"
          >
            <span aria-hidden="true" className="text-sm text-slate-400">
              {collapsed ? "▶" : "▼"}
            </span>
            Round {summary.round}
          </button>
          {summary.byeTeams.length > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
              Bye round
            </span>
          )}
          <WarningsBadge round={summary.round} warnings={summary.warnings} />
        </div>

        <div className="flex items-center">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 px-1 text-sm">
            <input
              type="checkbox"
              checked={planRound.boost}
              disabled={noBoosts}
              aria-label="Boost: plus one trade this round"
              onChange={(e) => props.onChange({ ...planRound, boost: e.target.checked })}
              className="h-5 w-5 accent-violet-500"
            />
            <span aria-hidden="true">Boost 🚀</span>
            {noBoosts && <span className="text-xs text-slate-400">none left</span>}
          </label>
          <InfoPopover label="About boosts">+1 trade this round (uses one of your boosts).</InfoPopover>
        </div>
      </div>

      {collapsed ? (
        <SummaryStrip summary={summary} />
      ) : (
        <RoundBody {...props} addState={addState} />
      )}
    </section>
  );
}

/** Trades 1/2 · Out · In · Cash (was) · Left · Boosts, one compact strip. */
function SummaryStrip({ summary }: { summary: RoundSummary }) {
  const overLimit = summary.tradesUsed > summary.tradeLimit;

  return (
    <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 sm:flex sm:flex-wrap sm:items-end sm:gap-x-6">
      <Stat label="Trades" value={`${summary.tradesUsed}/${summary.tradeLimit}`} bad={overLimit} />
      <Stat label="Out" value={formatMoney(summary.outTotal)} />
      <Stat label="In" value={formatMoney(summary.inTotal)} />
      <Stat
        label="Cash"
        value={formatMoney(summary.cashAfter)}
        detail={`was ${formatMoney(summary.cashBefore)}`}
        bad={summary.cashAfter < 0}
        prominent
      />
      <Stat
        label="Left"
        value={String(summary.tradesLeftAfter)}
        bad={summary.tradesLeftAfter < 0}
        info={<InfoPopover label="About trades left">Trades left in your season pool after this round.</InfoPopover>}
      />
      <Stat
        label="Boosts"
        value={String(summary.boostsLeftAfter)}
        info={
          <InfoPopover label="About boosts left">
            Boosts left for the season after this round. A boost gives one extra trade in a round.
          </InfoPopover>
        }
      />
    </dl>
  );
}

function Stat({
  label,
  value,
  detail,
  bad,
  prominent,
  info,
}: {
  label: string;
  value: string;
  detail?: string;
  bad?: boolean;
  prominent?: boolean;
  info?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
        {info}
      </dt>
      <dd
        className={`tabular-nums ${prominent ? "text-base font-bold" : "text-sm font-semibold"} ${
          bad ? "text-red-300" : "text-white"
        }`}
      >
        {value}
        {detail && <span className="block text-[11px] font-normal text-slate-400 sm:ml-1 sm:inline">{detail}</span>}
      </dd>
    </div>
  );
}

/** "Playing 30/31 · field 22/23", with the bye detail in its popover. */
function PlayingChip({ summary }: { summary: RoundSummary }) {
  const notCounted = summary.unavailablePlayerIds?.length ?? 0;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/40 pl-2.5 text-xs text-slate-300">
      <span className="tabular-nums">
        Playing {summary.playing}/{summary.squad.length} · field {summary.onFieldPlaying}/{summary.onFieldNeeded}
      </span>
      <InfoPopover label={`Round ${summary.round} byes and playing`}>
        {summary.byeTeams.length > 0 ? (
          <>
            On bye: {summary.byeTeams.join(", ")}. {summary.onBye} of your squad{" "}
            {summary.onBye === 1 ? "is" : "are"} on bye.
          </>
        ) : (
          <>No byes this round.</>
        )}
        {notCounted > 0 && (
          <span className="mt-1 block">
            {notCounted} injured or suspended player{notCounted === 1 ? "" : "s"} not counted as playing.
          </span>
        )}
      </InfoPopover>
    </span>
  );
}

function RoundBody({
  summary,
  planRound,
  squadBefore,
  playersById,
  allPlayers,
  priceAt,
  placeholders,
  fieldOpen,
  onChange,
  onToggleField,
  onNewRookie,
  onPlaceholderTeam,
  addState,
}: RoundCardProps & {
  addState: ReturnType<typeof getAddTradeState>;
}) {
  const round = summary.round;
  const priceFor = (player: Player) => priceAt(player.id, round);

  // Watchlisted players are pinned in "player in", after the Rookie (TBC)
  // options; those already in the squad or traded in are left out there.
  const watchlist = useWatchlist();
  const watchlistPlayers = useMemo(
    () => ({
      heading: "Watchlist",
      players: watchlist.entries
        .map((entry) => playersById.get(entry.id))
        .filter((p): p is Player => !!p && !isPlaceholderId(p.id)),
    }),
    [watchlist.entries, playersById],
  );

  // Squad going into the round, alphabetical (placeholders included).
  const squadPlayers = useMemo(
    () =>
      squadBefore
        .map((id) => playersById.get(id))
        .filter((p): p is Player => !!p)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [squadBefore, playersById],
  );

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
      <div className="mt-2 space-y-2">
        {planRound.trades.map((trade, index) => {
          const line = summary.trades[index];
          const inPlaceholder = placeholders.find((p) => p.id === trade.inId);
          const outIds = new Set(tradeOutCandidates(squadBefore, planRound.trades, index));
          const outPlayer = trade.outId === null ? null : playersById.get(trade.outId) ?? null;
          const inPlayer = trade.inId === null ? null : playersById.get(trade.inId) ?? null;
          const rookieOptions: PinnedOption[] = ROOKIE_OPTIONS.map((option) => ({
            key: option.position,
            label: `New Rookie (TBC) ${option.position}`,
            detail: `Placeholder • ${option.position}`,
            price: ROOKIE_PLACEHOLDER.price,
            onSelect: () => onNewRookie(index, option.position),
          }));
          const name = `Round ${round} trade ${index + 1}`;

          return (
            <div
              key={index}
              className="grid grid-cols-1 gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-2 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
            >
              <TradeSide
                side="out"
                label={`${name}: player out`}
                priceLabel={`${name}: price out`}
                placeholderText="Player out…"
                players={squadPlayers.filter((p) => outIds.has(p.id))}
                value={outPlayer}
                priceFor={priceFor}
                onSelect={(player) => setTrade(index, { outId: player.id })}
                onClear={() => setTrade(index, { outId: null })}
                price={trade.outId !== null ? line?.outPrice ?? null : null}
                defaultPrice={line?.outDefault ?? null}
                overridden={trade.outPriceOverride !== undefined}
                placeholder={trade.outId !== null && isPlaceholderId(trade.outId)}
                onSetPrice={(price) => setPrice(index, "out", price)}
              >
                {trade.outId !== null && !squadBefore.includes(trade.outId) && (
                  <p className="mt-1 text-xs text-amber-300">Not in the squad at this round.</p>
                )}
              </TradeSide>

              <TradeSide
                side="in"
                label={`${name}: player in`}
                priceLabel={`${name}: price in`}
                placeholderText="Player in…"
                players={allPlayers}
                excludeIds={tradeInExclusions(squadBefore, planRound.trades, index)}
                pinnedOptions={rookieOptions}
                featured={watchlistPlayers}
                value={inPlayer}
                priceFor={priceFor}
                onSelect={(player) => setTrade(index, { inId: player.id })}
                onClear={() => setTrade(index, { inId: null })}
                price={trade.inId !== null ? line?.inPrice ?? null : null}
                defaultPrice={line?.inDefault ?? null}
                overridden={trade.inPriceOverride !== undefined}
                placeholder={trade.inId !== null && isPlaceholderId(trade.inId)}
                onSetPrice={(price) => setPrice(index, "in", price)}
              >
                {inPlaceholder && (
                  <label className="mt-1 flex items-center gap-1.5 text-xs text-violet-200">
                    <span className="rounded bg-violet-500/30 px-1 font-bold">TBC</span>
                    Team
                    <select
                      value={inPlaceholder.team ?? ""}
                      onChange={(e) => onPlaceholderTeam(inPlaceholder.id, e.target.value || null)}
                      className="h-8 rounded border border-slate-700 bg-slate-950 px-1.5 text-xs text-slate-200"
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
              </TradeSide>

              <button
                type="button"
                onClick={() =>
                  onChange({ ...planRound, trades: planRound.trades.filter((_, i) => i !== index) })
                }
                className="min-h-11 justify-self-start rounded-lg border border-slate-700 px-3 text-xs text-slate-300 hover:text-white"
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
            className="min-h-11 rounded-lg border border-violet-500/50 px-3 text-xs font-semibold text-violet-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
          >
            + Add trade
          </button>

          {addState.reason && (
            <span className="text-xs text-slate-400">{addState.reason}</span>
          )}
        </div>
      </div>

      <SummaryStrip summary={summary} />

      {/* Field (its header shows the playing counts while it's open). */}
      <div className="mt-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={onToggleField}
            aria-expanded={fieldOpen}
            className="min-h-11 text-xs font-semibold text-violet-300 hover:text-violet-200"
          >
            {fieldOpen ? "Hide field" : "Show field"}
          </button>
          {!fieldOpen && <PlayingChip summary={summary} />}
        </div>

        {fieldOpen && (
          <div className="mt-1 rounded-xl border border-slate-800 bg-slate-950/50 p-2 sm:p-3">
            <FieldDiagram
              layout={buildFieldLayout(summary, playersById)}
              priceFor={(playerId) => priceAt(playerId, round)}
              round={round}
            />
          </div>
        )}
      </div>
    </>
  );
}

/**
 * One side of a trade: the player box with this trade's price on the same
 * line (out red, in green, typed prices amber with a dot). Tapping the
 * price opens the inline editor underneath: type an override (350000,
 * 350,000, $350k); Done applies it, Reset returns to the default.
 * Overrides change this trade's cash, never the engine's prices.
 */
function TradeSide({
  side,
  label,
  priceLabel,
  placeholderText,
  players,
  excludeIds,
  pinnedOptions,
  featured,
  value,
  priceFor,
  onSelect,
  onClear,
  price,
  defaultPrice,
  overridden,
  placeholder,
  onSetPrice,
  children,
}: {
  side: "in" | "out";
  label: string;
  priceLabel: string;
  placeholderText: string;
  players: Player[];
  excludeIds?: ReadonlySet<number>;
  pinnedOptions?: PinnedOption[];
  featured?: { heading: string; players: readonly Player[] };
  value: Player | null;
  priceFor: (player: Player) => number | null;
  onSelect: (player: Player) => void;
  onClear: () => void;
  price: number | null;
  defaultPrice: number | null;
  overridden: boolean;
  placeholder: boolean;
  onSetPrice: (price: number | null) => void;
  children?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const colour = overridden ? "text-amber-300" : side === "out" ? "text-red-300" : "text-emerald-300";
  const defaultLabel = defaultPrice === null ? "no default price" : `Default ${formatMoney(defaultPrice)}`;

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
    onSetPrice(result.price === defaultPrice ? null : result.price);
    setEditing(false);
  }

  const priceButton =
    price === null ? null : (
      <span className="flex h-full items-center gap-1">
        {placeholder && (
          <span className="rounded bg-violet-500/30 px-1 text-[10px] font-bold text-violet-100">TBC</span>
        )}
        <button
          type="button"
          onClick={() => (editing ? setEditing(false) : open())}
          aria-expanded={editing}
          aria-label={`${priceLabel}: ${formatMoney(price)}${overridden ? ` (typed; ${defaultLabel})` : ""}. Tap to change.`}
          title={overridden ? `Typed price. ${defaultLabel}.` : "Tap to type a price for this trade"}
          className={`flex h-full min-w-11 items-center justify-end gap-1 rounded px-1 text-sm font-semibold tabular-nums underline decoration-dotted underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${colour}`}
        >
          {formatMoney(price)}
          {overridden && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-300" />}
        </button>
      </span>
    );

  return (
    <div className="min-w-0">
      <div className="flex">
        <PlayerSelect
          label={label}
          placeholder={placeholderText}
          players={players}
          excludeIds={excludeIds}
          pinnedOptions={pinnedOptions}
          featured={featured}
          value={value}
          priceFor={priceFor}
          onSelect={onSelect}
          onClear={onClear}
          aside={priceButton}
        />
      </div>

      {children}

      {editing && price !== null && (
        <div className="mt-1.5 rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              aria-label={priceLabel}
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
              className="h-11 w-28 rounded-md border border-slate-600 bg-slate-950 px-2 text-right text-sm tabular-nums text-white outline-none focus:border-violet-500"
            />

            <button type="button" onClick={apply} className="h-11 rounded-md bg-violet-500 px-3 text-xs font-semibold text-white">
              Done
            </button>

            <button
              type="button"
              disabled={!overridden}
              onClick={() => {
                onSetPrice(null);
                setEditing(false);
              }}
              className="h-11 rounded-md border border-slate-600 px-3 text-xs font-semibold text-slate-200 disabled:opacity-40"
            >
              Reset
            </button>
          </div>

          <p className="mt-1 text-slate-400">{defaultLabel}. This trade only.</p>

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
