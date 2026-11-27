"use client";

/** The "Matchup adjustment" on/off switch (Projector and planner Scores view). */
export default function MatchupSwitch({
  on,
  onChange,
  className = "",
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      title="Add the opponent's difficulty for the player's position to projected scores"
      className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-xs font-semibold text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-violet-500" : "bg-slate-700"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[1.125rem]" : "left-0.5"}`}
        />
      </span>
      Matchup adjustment
    </button>
  );
}
