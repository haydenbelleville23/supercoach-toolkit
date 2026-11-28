"use client";

export type PlayerListFilter = "all" | "my-team" | "watchlist";

/**
 * "All players | My team (n) | Watchlist (n)": which players a list shows.
 * My team is disabled until a team is saved; Watchlist stays selectable
 * when empty, so its empty state can explain how to add players.
 */
export default function PlayerListFilterControl({
  value,
  onChange,
  myTeamCount,
  watchlistCount,
}: {
  value: PlayerListFilter;
  onChange: (value: PlayerListFilter) => void;
  myTeamCount: number;
  watchlistCount: number;
}) {
  const options: { id: PlayerListFilter; label: string; disabled?: boolean; title?: string }[] = [
    { id: "all", label: "All players" },
    {
      id: "my-team",
      label: `My team (${myTeamCount})`,
      disabled: myTeamCount === 0,
      title: myTeamCount === 0 ? "Save a team on My Team first" : undefined,
    },
    { id: "watchlist", label: `Watchlist (${watchlistCount})` },
  ];

  return (
    <div role="group" aria-label="Players to show" className="inline-flex rounded-lg border border-slate-700 p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          disabled={option.disabled && value !== option.id}
          title={option.title}
          onClick={() => onChange(option.id)}
          className={`min-h-9 rounded-md px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            value === option.id ? "bg-violet-500/25 text-violet-100" : "text-slate-300 hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Shown when the Watchlist filter is on and the list is empty. */
export function EmptyWatchlistMessage() {
  return (
    <div role="status" className="flex max-w-xl flex-col items-start gap-1">
      <p className="font-semibold text-white">Your watchlist is empty.</p>
      <p className="text-sm text-slate-400">
        Tap the star on a player in Cash Cows or the Price Projector to add them.
      </p>
    </div>
  );
}
