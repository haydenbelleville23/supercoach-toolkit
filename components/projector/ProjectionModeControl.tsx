"use client";

import type { ProjectionMode } from "@/lib/projector";
import { parseProjectionMode } from "@/lib/projector/projectionModes";

const OPTIONS: { value: ProjectionMode; label: string; title: string }[] = [
  { value: "projected", label: "Projected", title: "Season average from completed rounds" },
  { value: "season-average", label: "Season Avg", title: "Season average" },
  { value: "three-round-average", label: "3RA", title: "Three-round average" },
  { value: "five-round-average", label: "5RA", title: "Five-round average" },
];

type ProjectionModeControlProps = {
  value: ProjectionMode;
  onChange: (mode: ProjectionMode) => void;
};

/**
 * How future scores are prefilled: a native select on phones and a
 * compact segmented control from the sm breakpoint up.
 */
export default function ProjectionModeControl({ value, onChange }: ProjectionModeControlProps) {
  return (
    <>
      <label className="shrink-0 sm:hidden">
        <span className="sr-only">Prefill future scores with</span>
        <select
          value={value}
          onChange={(event) => onChange(parseProjectionMode(event.target.value))}
          className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm font-semibold text-white outline-none focus:border-violet-500"
        >
          {OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div
        role="radiogroup"
        aria-label="Prefill future scores with"
        className="hidden h-11 shrink-0 items-center gap-0.5 rounded-lg border border-slate-700 bg-slate-950 p-1 sm:flex"
      >
        {OPTIONS.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              title={option.title}
              onClick={() => onChange(option.value)}
              className={`h-full rounded-md px-2.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                selected
                  ? "bg-violet-500 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
