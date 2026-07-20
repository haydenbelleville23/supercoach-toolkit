"use client";

import type { ProjectionMode } from "@/lib/projector";

type ProjectionModeSelectorProps = {
  value: ProjectionMode;
  onChange: (mode: ProjectionMode) => void;
};

const options: {
  value: ProjectionMode;
  label: string;
}[] = [
  {
    value: "projected",
    label: "Projected",
  },
  {
    value: "season-average",
    label: "Season Avg",
  },
  {
    value: "three-round-average",
    label: "3RA",
  },
  {
    value: "five-round-average",
    label: "5RA",
  },
  {
    value: "custom",
    label: "Custom",
  },
];

export default function ProjectionModeSelector({
  value,
  onChange,
}: ProjectionModeSelectorProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-200">
          Projection scores
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Choose how future scores are prefilled.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {options.map((option) => {
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={isSelected}
              className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                isSelected
                  ? "border-violet-500 bg-violet-500 text-white shadow-lg shadow-violet-950/30"
                  : "border-slate-700 bg-slate-950 text-slate-300 hover:border-violet-500/60 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}