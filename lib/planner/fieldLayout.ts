import { isPlaceholderId } from "./placeholders";
import { buildSlots, type SlotArea, type SlotPosition } from "./positionMatching";
import type { RoundSummary } from "./evaluatePlan";

import type { Player } from "@/types/player";

export interface FieldSpot {
  slotId: string;
  player: Player | null;
  onBye: boolean;
  tradedIn: boolean;
  placeholder: boolean;
}

export interface FieldLine {
  area: SlotArea;
  position: SlotPosition;
  spots: FieldSpot[];
}

export interface FieldLayout {
  lines: FieldLine[];
  tradedOut: Player[];
  playingOnField: number;
  onFieldSlots: number;
  playingTotal: number;
  squadSize: number;
}

const LINE_ORDER: SlotPosition[] = ["DEF", "MID", "RUC", "FWD", "FLEX"];

/**
 * The squad after a round's trades laid out by slot: DEF, MID, RUC, FWD
 * and FLEX on the field, then the bench, using the round's (stable)
 * position matching. Marks players on bye and players traded in.
 */
export function buildFieldLayout(
  summary: RoundSummary,
  playersById: Map<number, Player>,
): FieldLayout {
  const bySlot = new Map<string, number>();
  for (const [playerId, slot] of summary.assignment) {
    bySlot.set(slot.id, playerId);
  }

  const bye = new Set(summary.byePlayerIds);
  const tradedIn = new Set(summary.tradedIn);
  const slots = buildSlots();

  const lines: FieldLine[] = [];

  for (const area of ["field", "bench"] as const) {
    for (const position of LINE_ORDER) {
      const lineSlots = slots.filter((s) => s.area === area && s.position === position);
      if (lineSlots.length === 0) {
        continue;
      }

      lines.push({
        area,
        position,
        spots: lineSlots.map((slot) => {
          const playerId = bySlot.get(slot.id);
          const player = playerId === undefined ? null : playersById.get(playerId) ?? null;

          return {
            slotId: slot.id,
            player,
            onBye: playerId !== undefined && bye.has(playerId),
            tradedIn: playerId !== undefined && tradedIn.has(playerId),
            placeholder: playerId !== undefined && isPlaceholderId(playerId),
          };
        }),
      });
    }
  }

  const fieldSpots = lines.filter((l) => l.area === "field").flatMap((l) => l.spots);

  return {
    lines,
    tradedOut: summary.tradedOut
      .map((id) => playersById.get(id))
      .filter((p): p is Player => !!p),
    playingOnField: fieldSpots.filter((s) => s.player && !s.onBye).length,
    onFieldSlots: fieldSpots.length,
    playingTotal: summary.playing,
    squadSize: summary.squad.length,
  };
}
