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
 * Rucks, Forwards and Flex (labels on the left from lg up), three cards
 * per row, with the bench to the right on wide screens and below on
 * phones. Each card shows the team logo and name, then that round's price
 * and markers: IN for a player traded in this round, BYE (dimmed, tagged)
 * for a team with no game. Players traded out are listed underneath.
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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <section aria-label="On field" className="space-y-2.5">
          {field.map((line) => (
            <Line key={line.position} line={line} title={LINE_NAMES[line.position]} priceFor={priceFor} availabilityFor={availabilityFor} labelLeft />
          ))}
        </section>

        <section
          aria-label="Bench"
          className="space-y-2.5 border-t border-slate-800 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"
        >
          <h4 className="font-semibold uppercase tracking-wide text-slate-400">Bench</h4>
          {bench.map((line) => (
            <Line key={line.position} line={line} title={line.position} priceFor={priceFor} availabilityFor={availabilityFor} bench />
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
  labelLeft = false,
  bench = false,
}: {
  line: FieldLine;
  title: string;
  priceFor: (playerId: number) => number | null;
  availabilityFor: AvailabilityLookup;
  /** Position label on the left from lg up (the field); above otherwise. */
  labelLeft?: boolean;
  /** Bench: two cards across from lg up, so it fits beside the field. */
  bench?: boolean;
}) {
  return (
    <div className={labelLeft ? "lg:flex lg:items-start lg:gap-3" : ""}>
      <h5
        className={`mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 ${
          labelLeft ? "lg:mb-0 lg:w-20 lg:shrink-0 lg:pt-1.5" : ""
        }`}
      >
        {title}
      </h5>
      <ul className={`${CARD_GRID} ${bench ? "lg:grid-cols-[repeat(2,9rem)]" : ""}`}>
        {line.spots.map((spot) => (
          <PlayerCard key={spot.slotId} spot={spot} priceFor={priceFor} availabilityFor={availabilityFor} />
        ))}
      </ul>
    </div>
  );
}

/**
 * At most three cards per row at every width: lines with more players
 * wrap onto further rows of three. Phones share the width; from sm up
 * the cards are a fixed 9rem.
 */
const CARD_GRID = "grid grid-cols-3 gap-1.5 sm:grid-cols-[repeat(3,9rem)]";

const TAG = "rounded px-1 text-[9.5px] font-bold leading-4";

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
      <li className="flex min-h-[4.25rem] items-center justify-center rounded-md border border-dashed border-slate-700 text-slate-500">
        Empty
      </li>
    );
  }

  const player = spot.player;
  const price = priceFor(player.id);
  const availability = availabilityFor(player);
  const hasBadge = !!availability && availability.status !== "available";
  const notes = [
    player.team ? player.team : null,
    spot.onBye ? "on bye" : null,
    spot.unavailable ? "not counted as playing" : null,
    spot.tradedIn ? "traded in" : null,
    spot.placeholder ? "rookie placeholder" : null,
  ].filter(Boolean);

  return (
    <li
      title={`${player.name}${notes.length ? ` (${notes.join(", ")})` : ""}`}
      className={`flex min-h-[4.25rem] min-w-0 flex-col justify-between gap-1 rounded-md border px-1.5 py-1 leading-tight ${
        spot.onBye
          ? "border-slate-700 bg-slate-950 text-slate-400 opacity-60"
          : spot.unavailable
            ? "border-dashed border-red-400/70 bg-red-950/40 text-slate-200"
            : spot.tradedIn
              ? "border-emerald-500/60 bg-emerald-500/10 text-white"
              : "border-slate-700 bg-slate-800/60 text-white"
      }`}
    >
      {/* Full name for screen readers; the short name below is visual. */}
      <span className="sr-only">
        {player.name}
        {notes.length ? `, ${notes.join(", ")}` : ""}
      </span>

      {/* Line 1: team logo and name. Wraps at spaces and hyphens, never cut off. */}
      <span aria-hidden="true" className="flex min-w-0 items-start gap-1">
        <TeamChip team={player.team} size={14} className="mt-px" />
        <span className="min-w-0 break-normal text-[11px] font-semibold">{cardName(spot)}</span>
      </span>

      {/* Line 2: price on the left; status, IN, BYE and TBC on the right. */}
      <span className="flex items-end justify-between gap-1">
        <span aria-hidden="true" className="text-[10.5px] tabular-nums text-slate-300">
          {price === null ? "-" : formatMoney(price)}
        </span>
        <span aria-hidden={!hasBadge || undefined} className="flex flex-wrap justify-end gap-0.5">
          {hasBadge && <AvailabilityBadge info={availability} size="xs" />}
          {spot.tradedIn && <span aria-hidden="true" className={`${TAG} bg-emerald-500/30 text-emerald-100`}>IN</span>}
          {spot.onBye && <span aria-hidden="true" className={`${TAG} bg-slate-600 text-slate-100`}>BYE</span>}
          {spot.placeholder && <span aria-hidden="true" className={`${TAG} bg-violet-500/30 text-violet-100`}>TBC</span>}
        </span>
      </span>

      {spot.unavailable && (
        <span aria-hidden="true" className={`${TAG} self-start bg-red-500/30 text-red-100`}>
          Not counted
        </span>
      )}
    </li>
  );
}
