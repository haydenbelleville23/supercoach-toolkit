import {
  POSITIONS,
  SQUAD_RULES,
  type Position,
} from "@/lib/rules/squadRules";

export type SlotArea = "field" | "bench";
export type SlotPosition = Position | "FLEX";

export interface Slot {
  id: string;
  area: SlotArea;
  position: SlotPosition;
}

/** A player to place. `pin` restricts them to one slot group if set. */
export interface MatchPlayer {
  id: number;
  name: string;
  eligible: Position[];
  pin?: { area: SlotArea; position: SlotPosition } | null;
  /** Used to field the most expensive players first (like SuperCoach). */
  price?: number;
}

export interface MatchResult {
  valid: boolean;
  /** Player id -> slot, for every player that could be placed. */
  assignment: Map<number, Slot>;
  /** Plain-language reasons the squad cannot be placed (empty if valid). */
  problems: string[];
}

/** Every slot in the squad, from SQUAD_RULES. */
export function buildSlots(area: SlotArea | "all" = "all"): Slot[] {
  const slots: Slot[] = [];

  const add = (slotArea: SlotArea, position: SlotPosition, count: number) => {
    for (let i = 1; i <= count; i++) {
      slots.push({ id: `${slotArea}-${position}-${i}`, area: slotArea, position });
    }
  };

  if (area !== "bench") {
    for (const position of POSITIONS) {
      add("field", position, SQUAD_RULES.onField[position]);
    }
    add("field", "FLEX", SQUAD_RULES.onFieldFlex);
  }

  if (area !== "field") {
    for (const position of POSITIONS) {
      add("bench", position, SQUAD_RULES.bench[position]);
    }
  }

  return slots;
}

function canFill(player: MatchPlayer, slot: Slot): boolean {
  if (player.pin) {
    if (player.pin.area !== slot.area || player.pin.position !== slot.position) {
      return false;
    }
  }

  return slot.position === "FLEX"
    ? player.eligible.length > 0
    : player.eligible.includes(slot.position);
}

/**
 * Maximum bipartite matching of players to slots (augmenting paths).
 * `allow` can further restrict which slots a player may take.
 */
export function matchPlayersToSlots(
  players: MatchPlayer[],
  slots: Slot[],
  allow: (player: MatchPlayer, slot: Slot) => boolean = () => true,
): Map<number, Slot> {
  const slotOwner = new Map<string, number>(); // slot id -> player index

  const tryPlace = (index: number, seen: Set<string>): boolean => {
    for (const slot of slots) {
      if (
        seen.has(slot.id) ||
        !canFill(players[index], slot) ||
        !allow(players[index], slot)
      ) {
        continue;
      }

      seen.add(slot.id);
      const owner = slotOwner.get(slot.id);

      if (owner === undefined || tryPlace(owner, seen)) {
        slotOwner.set(slot.id, index);
        return true;
      }
    }

    return false;
  };

  players.forEach((_, index) => tryPlace(index, new Set()));

  const assignment = new Map<number, Slot>();
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));

  for (const [slotId, index] of slotOwner) {
    assignment.set(players[index].id, slotById.get(slotId)!);
  }

  return assignment;
}

const list = (positions: Position[]) =>
  positions.length === 1
    ? positions[0]
    : `${positions.slice(0, -1).join(", ")} or ${positions[positions.length - 1]}`;

/**
 * Hall's condition over position groups: players who can only play
 * positions in S need at most as many slots as S has (plus the flex).
 * Returns the tightest broken group as a sentence, smallest group first.
 */
function explainShortage(players: MatchPlayer[]): string[] {
  const groups = Array.from({ length: (1 << POSITIONS.length) - 1 }, (_, i) =>
    POSITIONS.filter((__, bit) => (i + 1) & (1 << bit)),
  ).sort((a, b) => a.length - b.length);

  for (const group of groups) {
    const stuck = players.filter(
      (p) => p.eligible.length > 0 && p.eligible.every((pos) => group.includes(pos)),
    );

    const field = group.reduce((t, pos) => t + SQUAD_RULES.onField[pos], 0);
    const bench = group.reduce((t, pos) => t + SQUAD_RULES.bench[pos], 0);
    const capacity = field + bench + SQUAD_RULES.onFieldFlex;

    if (stuck.length > capacity) {
      return [
        `${stuck.length} players can only play ${list(group)}` +
          (group.length === 1 ? " (none are dual-position)" : "") +
          `, but there are only ${capacity} slots for them ` +
          `(${field} on-field + ${bench} bench + ${SQUAD_RULES.onFieldFlex} flex).`,
      ];
    }
  }

  return [];
}

/**
 * Places the squad the way SuperCoach auto-fields it: the most expensive
 * players on the field, the cheapest on the bench, while keeping every
 * player in a valid slot (dual positions and pins respected).
 *
 * Players are taken in price order (highest first); each joins the field
 * group only if the field group still fits the on-field slots AND the
 * whole squad can still be placed with that group on the field. This
 * greedy choice gives the highest-value field (the field slots form a
 * transversal matroid). If no valid placement exists, as many players as
 * possible are placed.
 */
export function assignByPrice(players: MatchPlayer[]): Map<number, Slot> {
  const allSlots = buildSlots();
  const fieldSlots = buildSlots("field");
  const bestSize = matchPlayersToSlots(players, allSlots).size;

  const byPrice = [...players].sort(
    (a, b) => (b.price ?? 0) - (a.price ?? 0) || a.id - b.id,
  );

  // Players pinned to the field are on it; then the rest by price.
  const order = [
    ...byPrice.filter((p) => p.pin?.area === "field"),
    ...byPrice.filter((p) => p.pin?.area !== "field" && p.pin?.area !== "bench"),
  ];

  const field = new Set<number>();

  for (const player of order) {
    const trial = new Set(field).add(player.id);
    const trialPlayers = players.filter((p) => trial.has(p.id));

    if (matchPlayersToSlots(trialPlayers, fieldSlots).size !== trialPlayers.length) {
      continue;
    }

    const placed = matchPlayersToSlots(
      players,
      allSlots,
      (p, slot) => !trial.has(p.id) || slot.area === "field",
    ).size;

    if (placed >= bestSize) {
      field.add(player.id);
    }
  }

  const fieldFirst = matchPlayersToSlots(players, allSlots, (p, slot) =>
    field.has(p.id) ? slot.area === "field" : slot.area === "bench",
  );

  if (fieldFirst.size >= bestSize) {
    return fieldFirst;
  }

  // Field group can't fill every field slot (squad not complete yet):
  // keep it on the field and let everyone else go anywhere.
  const fieldOnly = matchPlayersToSlots(
    players,
    allSlots,
    (p, slot) => !field.has(p.id) || slot.area === "field",
  );

  return fieldOnly.size >= bestSize
    ? fieldOnly
    : matchPlayersToSlots(players, allSlots);
}

/** Can the whole squad be placed in valid slots? */
export function checkSquadPositions(players: MatchPlayer[]): MatchResult {
  const assignment = assignByPrice(players);
  const problems: string[] = [];

  if (players.length !== SQUAD_RULES.squadSize) {
    problems.push(
      `The squad has ${players.length} players; it needs ${SQUAD_RULES.squadSize}.`,
    );
  }

  const noPosition = players.filter((p) => p.eligible.length === 0);
  if (noPosition.length > 0) {
    problems.push(
      `${noPosition.map((p) => p.name).join(", ")} ${noPosition.length === 1 ? "has" : "have"} no position in the data.`,
    );
  }

  const unplaced = players.filter((p) => !assignment.has(p.id));

  if (unplaced.length > 0 && players.length <= SQUAD_RULES.squadSize) {
    const shortage = explainShortage(players);

    if (shortage.length > 0) {
      problems.push(...shortage);
    } else {
      problems.push(
        `These players can't be placed with the current pins: ${unplaced
          .map((p) => p.name)
          .join(", ")}. Set their placement to Auto or move another player.`,
      );
    }
  }

  return { valid: problems.length === 0, assignment, problems };
}

/**
 * Can the on-field slots be filled from the players who are playing this
 * round? Used by the bye view. Returns shortfalls in plain words.
 */
export function checkOnFieldPlaying(players: MatchPlayer[]): {
  filled: number;
  needed: number;
  problems: string[];
} {
  const slots = buildSlots("field");
  const unpinned = players.map((p) => ({ ...p, pin: null }));
  const filled = matchPlayersToSlots(unpinned, slots).size;
  const problems: string[] = [];

  if (filled < slots.length) {
    for (const position of POSITIONS) {
      const available = unpinned.filter((p) => p.eligible.includes(position)).length;
      const needed = SQUAD_RULES.onField[position];

      if (available < needed) {
        problems.push(
          `Only ${available} playing ${position}-eligible players for ${needed} on-field ${position} spots.`,
        );
      }
    }

    if (problems.length === 0) {
      problems.push(
        `Only ${filled} of ${slots.length} on-field spots can be filled with players who are playing.`,
      );
    }
  }

  return { filled, needed: slots.length, problems };
}
