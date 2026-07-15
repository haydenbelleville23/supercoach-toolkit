"use client";

type ProjectionMode =
  | "api"
  | "season-average"
  | "three-round-average"
  | "five-round-average"
  | "custom";

type ProjectionModeSelectorProps = {
  value: ProjectionMode;
  onChange: (mode: ProjectionMode) => void;
};

const options: {
  value: ProjectionMode;
  label: string;
}[] = [
  {
    value: "api",
    label: "API",
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-200">
            Projection scores
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Choose how future scores are prefilled.
          </p>
        </div>

        <select
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value as ProjectionMode,
            )
          }
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-emerald-500"
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}