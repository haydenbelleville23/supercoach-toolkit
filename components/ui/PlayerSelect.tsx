"use client";

import { Search, X } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { formatMoney } from "@/lib/format";
import { normaliseSearchText, searchPlayers } from "@/lib/players/playerSearch";
import { shortPlayerName } from "@/lib/players/shortName";
import type { Player } from "@/types/player";

import TeamChip from "./TeamChip";

/** An extra choice pinned above the players (e.g. "New Rookie (TBC) MID"). */
export interface PinnedOption {
  key: string;
  label: string;
  /** Second line, e.g. "Placeholder • MID". */
  detail?: string;
  /** Shown right-aligned like a player's price. */
  price?: number | null;
  onSelect: () => void;
}

export interface PlayerSelectProps {
  players: readonly Player[];
  /** The selected player, shown in the box while closed. */
  value: Player | null;
  onSelect: (player: Player) => void;
  /** Shown in the box while it's empty. */
  placeholder?: string;
  /** Players left out of the list entirely. */
  excludeIds?: ReadonlySet<number>;
  /**
   * Players shown but not selectable, with the reason on the row. A map
   * of id to reason, or a function (only called for rows on screen).
   */
  disabledReasons?: ReadonlyMap<number, string> | ((player: Player) => string | null);
  /** Price shown right-aligned on each row. */
  priceFor?: (player: Player) => number | null;
  /** Pinned above the players while the search is empty or matches them. */
  pinnedOptions?: readonly PinnedOption[];
  autoFocus?: boolean;
  /** Accessible name of the search box. */
  label: string;
  ariaDescribedBy?: string;
  /** Prefix for element ids (the Projector uses "player"). */
  idPrefix?: string;
  /** Shows a clear button while a player is selected. */
  onClear?: () => void;
  /**
   * After a pick, keep focus and the list open with the search cleared,
   * for adding several players in a row.
   */
  keepOpenAfterSelect?: boolean;
  /** Most rows rendered at once (default 50). */
  maxResults?: number;
}

type Row =
  | { kind: "pinned"; key: string; option: PinnedOption; disabled: false }
  | { kind: "player"; key: string; player: Player; reason: string | null; disabled: boolean };

const DEFAULT_MAX_RESULTS = 50;
const MAX_LIST_HEIGHT = 288;
const MIN_LIST_HEIGHT = 132;

/**
 * Player search with a results list: team logo, bold name and a
 * "Team • POS" line, an optional price, and disabled rows with a reason.
 * Case, accents and punctuation are ignored; surname matches come first.
 *
 * Keyboard: Up/Down move (skipping disabled rows), Enter picks the
 * highlighted row (or the first selectable one), Escape closes. Options
 * are not in the Tab order.
 *
 * On phones the list opens below or above the box, whichever has more
 * room above the on-screen keyboard (visualViewport), and never scrolls
 * the page itself.
 */
export default function PlayerSelect({
  players,
  value,
  onSelect,
  placeholder = "Search player...",
  excludeIds,
  disabledReasons,
  priceFor,
  pinnedOptions = [],
  autoFocus = false,
  label,
  ariaDescribedBy,
  idPrefix,
  onClear,
  keepOpenAfterSelect = false,
  maxResults = DEFAULT_MAX_RESULTS,
}: PlayerSelectProps) {
  const reactId = useId().replace(/:/g, "");
  const prefix = idPrefix ?? `ps${reactId}`;
  const inputId = `${prefix}-search`;
  const listId = `${prefix}-search-results`;
  const optionId = (key: string) => `${prefix}-option-${key}`;

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState<{ above: boolean; maxHeight: number }>({
    above: false,
    maxHeight: MAX_LIST_HEIGHT,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filtering 800+ players can lag behind fast typing on a phone; the
  // input stays responsive and the list catches up.
  const deferredQuery = useDeferredValue(query);

  const matches = useMemo(() => {
    const pool = excludeIds?.size ? players.filter((p) => !excludeIds.has(p.id)) : players;
    return searchPlayers(pool, deferredQuery);
  }, [players, excludeIds, deferredQuery]);

  const rows: Row[] = useMemo(() => {
    const q = normaliseSearchText(deferredQuery);
    const pinned = pinnedOptions
      .filter((option) => {
        if (!q) return true;
        const text = normaliseSearchText(`${option.label} ${option.detail ?? ""}`);
        return q.split(" ").every((token) => text.split(" ").some((w) => w.startsWith(token)));
      })
      .map((option): Row => ({ kind: "pinned", key: `pin-${option.key}`, option, disabled: false }));

    const reasonFor = (player: Player): string | null =>
      !disabledReasons
        ? null
        : typeof disabledReasons === "function"
          ? disabledReasons(player)
          : (disabledReasons.get(player.id) ?? null);

    const playerRows = matches.slice(0, maxResults).map((player): Row => {
      const reason = reasonFor(player);
      return { kind: "player", key: String(player.id), player, reason, disabled: reason !== null };
    });

    return [...pinned, ...playerRows];
  }, [matches, pinnedOptions, disabledReasons, maxResults, deferredQuery]);

  const hiddenCount = Math.max(0, matches.length - maxResults);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }, []);

  // Room for the list above the on-screen keyboard.
  const measure = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    const rect = input.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport ? viewport.offsetTop : 0;
    const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
    const below = bottom - rect.bottom - 8;
    const aboveSpace = rect.top - top - 8;
    const above = below < MIN_LIST_HEIGHT * 1.5 && aboveSpace > below;

    setPlacement({
      above,
      maxHeight: Math.max(
        MIN_LIST_HEIGHT,
        Math.min(MAX_LIST_HEIGHT, above ? aboveSpace : below),
      ),
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    measure();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);

    // Close on a tap outside (the input's blur covers most cases; this
    // covers taps that don't move focus).
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen, measure, close]);

  function pick(row: Row) {
    if (row.disabled) return;

    if (row.kind === "pinned") {
      row.option.onSelect();
    } else {
      onSelect(row.player);
    }

    setQuery("");
    setActiveIndex(-1);

    if (keepOpenAfterSelect) {
      // By id rather than ref: pick is passed to the option rows.
      document.getElementById(inputId)?.focus();
      const list = document.getElementById(listId);
      if (list) list.scrollTop = 0;
    } else {
      setIsOpen(false);
    }
  }

  // Scroll the list (never the page) so the highlighted row is visible.
  function revealRow(index: number) {
    const list = listRef.current;
    const element = document.getElementById(optionId(rows[index].key));
    if (!list || !element) return;

    if (element.offsetTop < list.scrollTop) {
      list.scrollTop = element.offsetTop;
    } else if (element.offsetTop + element.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = element.offsetTop + element.offsetHeight - list.clientHeight;
    }
  }

  function moveActive(step: number) {
    const count = rows.length;
    if (count === 0) return;

    let next = activeIndex;
    for (let i = 0; i < count; i++) {
      next =
        next === -1 ? (step > 0 ? 0 : count - 1) : (next + step + count) % count;
      if (!rows[next].disabled) {
        setActiveIndex(next);
        revealRow(next);
        return;
      }
    }
  }

  const active = isOpen && activeIndex >= 0 ? rows[activeIndex] : undefined;
  const accessibleName = value ? `${label} (selected: ${value.name}${value.team ? `, ${value.team}` : ""})` : label;

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      />

      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active ? optionId(active.key) : undefined}
        aria-label={accessibleName}
        aria-describedby={ariaDescribedBy}
        value={query}
        placeholder={isOpen || !value ? placeholder : ""}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
        autoFocus={autoFocus}
        onFocus={() => {
          setIsOpen(true);
          setQuery("");
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onBlur={() => window.setTimeout(() => {
          if (document.activeElement !== inputRef.current) close();
        }, 150)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            close();
            event.currentTarget.blur();
          }

          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
            moveActive(event.key === "ArrowDown" ? 1 : -1);
          }

          if (event.key === "Enter") {
            event.preventDefault();
            const row = active ?? rows.find((r) => !r.disabled);
            if (row) pick(row);
          }
        }}
        className={`h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 ${
          onClear && value ? "pr-10" : "pr-3"
        }`}
      />

      {/* The selected player, shown over the empty input while closed. */}
      {!isOpen && value && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-9 flex min-w-0 items-center gap-1.5 text-sm ${
            onClear ? "right-10" : "right-3"
          }`}
        >
          <span className="truncate font-semibold text-white">
            <span className="sm:hidden">{shortPlayerName(value.name)}</span>
            <span className="hidden sm:inline">{value.name}</span>
          </span>
          <span className="shrink-0 rounded bg-slate-800 px-1 text-[10px] font-bold leading-4 text-slate-300">
            {value.team || "TBC"}
          </span>
        </span>
      )}

      {onClear && value && !isOpen && (
        <button
          type="button"
          onClick={() => {
            onClear();
            inputRef.current?.focus();
          }}
          aria-label={`Clear ${label.toLowerCase()}`}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}

      {isOpen && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Players"
          tabIndex={-1}
          style={{ maxHeight: placement.maxHeight }}
          className={`absolute z-40 w-full min-w-64 overflow-y-auto overscroll-contain rounded-lg border border-slate-700 bg-slate-950 shadow-xl ${
            placement.above ? "bottom-full mb-1" : "mt-1"
          }`}
        >
          {rows.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No players found.</p>
          ) : (
            rows.map((row, index) => (
              <OptionRow
                key={row.key}
                id={optionId(row.key)}
                row={row}
                active={index === activeIndex}
                selected={row.kind === "player" && row.player.id === value?.id}
                price={
                  row.kind === "pinned"
                    ? (row.option.price ?? null)
                    : priceFor
                      ? priceFor(row.player)
                      : null
                }
                onPick={() => pick(row)}
              />
            ))
          )}

          {hiddenCount > 0 && (
            <p className="border-t border-slate-800 px-3 py-2 text-xs text-slate-400">
              {hiddenCount} more. Keep typing to narrow the list.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function OptionRow({
  id,
  row,
  active,
  selected,
  price,
  onPick,
}: {
  id: string;
  row: Row;
  active: boolean;
  selected: boolean;
  price: number | null;
  onPick: () => void;
}) {
  const name = row.kind === "pinned" ? row.option.label : row.player.name;
  const detail =
    row.kind === "pinned"
      ? row.option.detail
      : `${row.player.teamName || row.player.team || "No team"} • ${row.player.positions.join(" / ")}`;
  const reason = row.kind === "player" ? row.reason : null;

  return (
    <button
      id={id}
      type="button"
      role="option"
      tabIndex={-1}
      aria-selected={active}
      aria-disabled={row.disabled || undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
      className={`flex min-h-11 w-full items-center gap-3 border-b border-slate-800 px-3 py-2 text-left transition last:border-b-0 ${
        row.disabled
          ? "cursor-not-allowed opacity-60"
          : active
            ? "bg-violet-500/25 ring-1 ring-inset ring-violet-500"
            : selected
              ? "bg-violet-500/10"
              : row.kind === "pinned"
                ? "bg-violet-500/5 hover:bg-slate-900"
                : "hover:bg-slate-900"
      }`}
    >
      {row.kind === "pinned" ? (
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/30 text-sm font-bold text-violet-100"
        >
          +
        </span>
      ) : (
        <TeamChip team={row.player.team} />
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{name}</span>
        {detail && <span className="block truncate text-xs text-slate-400">{detail}</span>}
      </span>

      {(price !== null || reason) && (
        <span className="shrink-0 text-right text-xs tabular-nums">
          {price !== null && <span className="block text-slate-300">{formatMoney(price)}</span>}
          {reason && <span className="block font-semibold text-amber-300">{reason}</span>}
        </span>
      )}
    </button>
  );
}
