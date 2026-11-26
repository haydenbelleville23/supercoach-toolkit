import { formatMoney } from "@/lib/format";
import type { Player } from "@/types/player";

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="shrink-0 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-sm font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

/**
 * The selected player's numbers in one strip (scrolls sideways on phones
 * if needed), followed by positions, club and any injury or availability
 * note. Replaces the large player card.
 */
export default function PlayerStatChips({ player }: { player: Player }) {
  return (
    <section
      aria-label={`${player.name}: ${player.positions.join("/")}, ${player.teamName}`}
      className="-mx-4 flex items-stretch gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      <Chip label="Price" value={formatMoney(player.price)} />
      <Chip label="BE" value={player.breakeven.toString()} />
      <Chip label="Avg" value={player.average.toFixed(1)} />
      <Chip label="3RA" value={player.average3.toFixed(1)} />
      <Chip label="5RA" value={player.average5.toFixed(1)} />
      <Chip label="Gms" value={player.games.toString()} />
      {player.ownership !== null && (
        <Chip label="Own" value={`${player.ownership.toFixed(1)}%`} />
      )}

      <div className="flex shrink-0 flex-col justify-center px-1 text-xs leading-4 text-slate-400">
        <span className="font-semibold text-slate-200">{player.positions.join(" / ")}</span>
        <span>{player.teamName}</span>
      </div>

      {player.availability && (
        <p className="flex shrink-0 items-center self-center rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-400">
          {player.availability}
        </p>
      )}
    </section>
  );
}
