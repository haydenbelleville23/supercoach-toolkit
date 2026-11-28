"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import {
  PRICE_PRESETS,
  PRICE_SLIDER_STEP,
  formatPriceShort,
  isPriceRangeActive,
  normalisePriceRange,
  parsePriceInput,
  presetFor,
  priceRangeLabel,
  type PriceRange,
} from "@/lib/cashcows/priceRange";
import { formatMoney } from "@/lib/format";

const toText = (value: number | null) => (value === null ? "" : formatMoney(value));

/**
 * "Price" button opening a popover: preset chips, Min and Max boxes and a
 * two-handle slider (two native range inputs), all showing the same range.
 */
export default function PriceRangeControl({
  value,
  onChange,
  bounds,
  className = "",
}: {
  value: PriceRange;
  onChange: (range: PriceRange) => void;
  /** The slider's ends: the pool's lowest and highest price. */
  bounds: { low: number; high: number };
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  // Opens to the right of the button, or to its left when there isn't room.
  const [alignRight, setAlignRight] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // The boxes' text follows the range until the user types in them.
  const [minText, setMinText] = useState(toText(value.min));
  const [maxText, setMaxText] = useState(toText(value.max));
  const [error, setError] = useState<string | null>(null);
  const [shownRange, setShownRange] = useState(value);
  if (shownRange.min !== value.min || shownRange.max !== value.max) {
    setShownRange(value);
    setMinText(toText(value.min));
    setMaxText(toText(value.max));
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  function commit(side: "min" | "max", text: string) {
    const trimmed = text.trim();
    const parsed = trimmed === "" ? null : parsePriceInput(trimmed);
    if (trimmed !== "" && parsed === null) {
      setError("Enter a price like 350000, 350,000, $350k or 350k.");
      if (side === "min") setMinText(toText(value.min));
      else setMaxText(toText(value.max));
      return;
    }
    setError(null);
    const next = normalisePriceRange({ ...value, [side]: parsed }, side);
    onChange(next);
    // Show the cleaned value even when the range didn't change.
    setMinText(toText(next.min));
    setMaxText(toText(next.max));
  }

  const lowValue = value.min ?? bounds.low;
  const highValue = value.max ?? bounds.high;
  const span = Math.max(bounds.high - bounds.low, 1);
  const pct = (price: number) => ((Math.min(Math.max(price, bounds.low), bounds.high) - bounds.low) / span) * 100;
  const active = isPriceRangeActive(value);
  const selectedPreset = presetFor(value);

  const box =
    "h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm tabular-nums text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20";

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-label={active ? `Price filter: ${priceRangeLabel(value)}` : "Price filter"}
        onClick={() => {
          const rect = buttonRef.current?.getBoundingClientRect();
          // The panel is 20rem (320px) wide at most.
          setAlignRight(!!rect && rect.left + Math.min(320, window.innerWidth - 32) > window.innerWidth - 8);
          setOpen((current) => !current);
        }}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
          active ? "border-violet-500 bg-violet-500/15 text-violet-100" : "border-slate-700 bg-slate-950 text-white"
        }`}
      >
        Price
        <ChevronDown aria-hidden="true" className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={`${id}-panel`}
          role="dialog"
          aria-label="Price range"
          className={`absolute z-50 mt-1 w-[min(20rem,calc(100vw-2rem))] ${alignRight ? "right-0" : "left-0"} space-y-4 rounded-xl border border-slate-700 bg-slate-950 p-4 shadow-xl`}
        >
          <div role="group" aria-label="Price presets" className="flex flex-wrap gap-1.5">
            {PRICE_PRESETS.map((preset) => {
              const on = selectedPreset?.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(on ? { min: null, max: null } : preset.range)}
                  className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                    on ? "border-violet-500 bg-violet-500/25 text-violet-100" : "border-slate-700 text-slate-300 hover:text-white"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-400">
              Min
              <input
                type="text"
                inputMode="decimal"
                value={minText}
                placeholder={formatMoney(bounds.low)}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(event) => setMinText(event.target.value)}
                onBlur={(event) => commit("min", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commit("min", event.currentTarget.value);
                }}
                className={`mt-1 ${box}`}
              />
            </label>
            <label className="text-xs font-semibold text-slate-400">
              Max
              <input
                type="text"
                inputMode="decimal"
                value={maxText}
                placeholder={formatMoney(bounds.high)}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(event) => setMaxText(event.target.value)}
                onBlur={(event) => commit("max", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commit("max", event.currentTarget.value);
                }}
                className={`mt-1 ${box}`}
              />
            </label>
          </div>

          {error && (
            <p id={`${id}-error`} role="alert" className="text-xs text-amber-200">
              {error}
            </p>
          )}

          {/* Two native range inputs over one track. */}
          <div className="dual-range relative h-11" style={{ ["--lo" as string]: `${pct(lowValue)}%`, ["--hi" as string]: `${pct(highValue)}%` }}>
            <div aria-hidden="true" className="dual-range-track" />
            <input
              type="range"
              aria-label="Minimum price"
              aria-valuetext={value.min === null ? "No minimum" : formatMoney(value.min)}
              min={bounds.low}
              max={bounds.high}
              step={PRICE_SLIDER_STEP}
              value={lowValue}
              onChange={(event) => {
                const next = Math.min(Number(event.target.value), highValue);
                onChange({ min: next <= bounds.low ? null : next, max: value.max });
              }}
            />
            <input
              type="range"
              aria-label="Maximum price"
              aria-valuetext={value.max === null ? "No maximum" : formatMoney(value.max)}
              min={bounds.low}
              max={bounds.high}
              step={PRICE_SLIDER_STEP}
              value={highValue}
              onChange={(event) => {
                const next = Math.max(Number(event.target.value), lowValue);
                onChange({ min: value.min, max: next >= bounds.high ? null : next });
              }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="tabular-nums">
              {formatPriceShort(lowValue)} to {formatPriceShort(highValue)}
            </span>
            <button
              type="button"
              disabled={!active}
              onClick={() => onChange({ min: null, max: null })}
              className="min-h-9 rounded-md px-2 font-semibold text-violet-300 hover:text-violet-100 disabled:opacity-40"
            >
              Any price
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
