"use client";

import AvailabilityBadge from "@/components/ui/AvailabilityBadge";
import AvailabilitySampleNotice from "@/components/ui/AvailabilitySampleNotice";
import TeamChip from "@/components/ui/TeamChip";
import { availabilityFor as loadedAvailabilityFor } from "@/lib/availability";
import type { RoundAvailability } from "@/lib/availability/selectors";
import { formatMoney } from "@/lib/format";
import type { FieldLayout, FieldLine, FieldSpot } from "@/lib/planner/fieldLayout";
import { shortPlayerName } from "@/lib/players/shortName";
import type { Player } from "@/types/player";

type AvailabilityLookup = (player: Player) => RoundAvailability | null;

const LINE_NAMES: Record<string, string> = {
  DEF: "Defenders",
  MID: "Midfielders",
  RUC: "Rucks",
  FWD: "Forwards",
  FLEX: "Flex",
};

/** Short name for a card: "N. Daicos", or "Rookie MID" for a placeholder. */
function cardName(spot: FieldSpot): string {
  const name = spot.player?.name ?? "";
  return spot.placeholder ? name.replace("Rookie (TBC) ", "Rookie ") : shortPlayerName(name);
}

/**
 * The squad after a round's trades as a field: Defenders, Midfielders,
 * Rucks, Forwards and Flex, with the bench to the right on wide screens
 * and below on phones. Each card shows the short name, team logo and that
 * round's price; IN marks a player traded in this round, BYE (dimmed,
 * tagged) a player whose team has no game. Players traded out are listed
 * underneath.
 */
export default function FieldDiagram({
  layout,
  priceFor,
  round,
  availabilityFor = (player) => loadedAvailabilityFor(player, round),
}: {
  layout: FieldLayout;
  /** The player's price at this round. */
  priceFor: (playerId: number) => number | null;
  round: number;
  /** Status badge per player (default: the loaded availability list). */
  availabilityFor?: AvailabilityLookup;
}) {
  const field = layout.lines.filter((l) => l.area === "field");
  const bench = layout.lines.filter((l) => l.area === "bench");

  return (
    <div className="space-y-3 text-xs">
      <AvailabilitySampleNotice />

      <p className="text-slate-300">
        Total playing{" "}
        <strong className="text-white">
          {layout.playingOnField}/{layout.onFieldSlots}
        </strong>
        {" · "}
        Squad playing{" "}
        <strong className="text-white">
          {layout.playingTotal}/{layout.squadSize}
        </strong>
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <section aria-label="On field" className="space-y-2.5">
          {field.map((line) => (
            <Line key={line.position} line={line} title={LINE_NAMES[line.position]} priceFor={priceFor} availabilityFor={availabilityFor} centred />
          ))}
        </section>

        <section
          aria-label="Bench"
          className="space-y-2.5 border-t border-slate-800 pt-3 lg:w-[6.5rem] lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"
        >
          <h4 className="font-semibold uppercase tracking-wide text-slate-400">Bench</h4>
          {bench.map((line) => (
            <Line key={line.position} line={line} title={line.position} priceFor={priceFor} availabilityFor={availabilityFor} />
          ))}
        </section>
      </div>

      {layout.tradedOut.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-300">
          <span className="font-semibold text-red-300">Out:</span>
          {layout.tradedOut.map((player) => (
            <span key={player.id} className="inline-flex items-center gap-1">
              <TeamChip team={player.team} size={14} />
              {player.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Line({
  line,
  title,
  priceFor,
  availabilityFor,
  centred = false,
}: {
  line: FieldLine;
  title: string;
  priceFor: (playerId: number) => number | null;
  availabilityFor: AvailabilityLookup;
  centred?: boolean;
}) {
  return (
    <div>
      <h5 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h5>
      <ul className={`flex flex-wrap gap-1.5 ${centred ? "sm:justify-center" : ""}`}>
        {line.spots.map((spot) => (
          <PlayerCard key={spot.slotId} spot={spot} priceFor={priceFor} availabilityFor={availabilityFor} />
        ))}
      </ul>
    </div>
  );
}

/** Three cards per row on phones, a fixed width from sm up. */
const CARD_WIDTH = "w-[calc((100%-0.75rem)/3)] sm:w-[5.5rem]";

export function PlayerCard({
  spot,
  priceFor,
  availabilityFor,
}: {
  spot: FieldSpot;
  priceFor: (playerId: number) => number | null;
  availabilityFor: AvailabilityLookup;
}) {
  if (!spot.player) {
    return (
      <li
        className={`${CARD_WIDTH} flex min-h-[3.75rem] items-center justify-center rounded-md border border-dashed border-slate-700 text-slate-500`}
      >
        Empty
      </li>
    );
  }

  const player = spot.player;
  const price = priceFor(player.id);
  const availability = availabilityFor(player);
  const hasBadge = !!availability && availability.status !== "available";

  return (
    <li
      title={`${player.name}${player.team ? `, ${player.team}` : ""}${spot.onBye ? " (bye)" : ""}${spot.unavailable ? " (not counted as playing)" : ""}${spot.tradedIn ? " (traded in)" : ""}`}
      className={`${CARD_WIDTH} relative min-h-[3.75rem] rounded-md border px-1.5 py-1 leading-tight ${
        spot.onBye
          ? "border-slate-700 bg-slate-950 text-slate-400 opacity-60"
          : spot.unavailable
            ? "border-dashed border-red-400/70 bg-red-950/40 text-slate-200"
            : spot.tradedIn
            ? "border-emerald-500/60 bg-emerald-500/10 text-white"
            : "border-slate-700 bg-slate-800/60 text-white"
      }`}
    >
      {/* Status corner. */}
      {hasBadge && (
        <span className="absolute right-0.5 top-0.5">
          <AvailabilityBadge info={availability} size="xs" />
        </span>
      )}

      {/* Room for the corner badge (TEST is the widest). */}
      <p
        className={`truncate text-[11px] font-semibold ${
          !hasBadge ? "" : availability.status === "test" ? "pr-10" : "pr-8"
        }`}
      >
        {cardName(spot)}
      </p>

      <p className="mt-0.5 flex items-center gap-1">
        <TeamChip team={player.team} size={14} />
        <span className="truncate text-[10.5px] tabular-nums text-slate-300">
          {price === null ? "-" : formatMoney(price)}
        </span>
      </p>

      <p className="mt-0.5 flex h-3.5 gap-1">
        {spot.tradedIn && (
          <span className="rounded bg-emerald-500/30 px-1 text-[9.5px] font-bold leading-3.5 text-emerald-100">
            IN
          </span>
        )}
        {spot.unavailable && (
          <span className="rounded bg-red-500/30 px-1 text-[9.5px] font-bold leading-3.5 text-red-100">
            Not counted
          </span>
        )}
        {spot.onBye && (
          <span className="rounded bg-slate-600 px-1 text-[9.5px] font-bold leading-3.5 text-slate-100">
            BYE
          </span>
        )}
        {spot.placeholder && (
          <span className="rounded bg-violet-500/30 px-1 text-[9.5px] font-bold leading-3.5 text-violet-100">
            TBC
          </span>
        )}
      </p>
    </li>
  );
}
