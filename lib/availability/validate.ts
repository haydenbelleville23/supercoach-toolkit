import {
  AVAILABILITY_STATUSES,
  type AvailabilitySnapshot,
  type PlayerAvailability,
} from "./types";

export type ValidationResult =
  | { ok: true; snapshot: AvailabilitySnapshot | null }
  | { ok: false; errors: string[] };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNullableString = (v: unknown) => v === null || typeof v === "string";
const isNullableNumber = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v));

/**
 * Checks an availability file. `{ "none": true }` (the stub used when
 * there's no file) is valid and means no data. Anything malformed is an
 * error listing every problem, so a bad file never shows half-right data.
 */
export function validateAvailability(raw: unknown): ValidationResult {
  if (isObject(raw) && raw.none === true) {
    return { ok: true, snapshot: null };
  }

  const errors: string[] = [];

  if (!isObject(raw)) {
    return { ok: false, errors: ["The file is not an object."] };
  }

  if (typeof raw.season !== "number") errors.push("season must be a number.");
  if (typeof raw.asOf !== "string" || !DATE.test(raw.asOf)) errors.push("asOf must be YYYY-MM-DD.");
  if (typeof raw.round !== "number") errors.push("round must be a number.");
  if (typeof raw.source !== "string") errors.push("source must be a string.");
  if (raw.sample !== undefined && typeof raw.sample !== "boolean") errors.push("sample must be true or false.");
  if (!isObject(raw.players)) errors.push("players must be an object keyed by player id.");

  if (isObject(raw.players)) {
    for (const [id, value] of Object.entries(raw.players)) {
      const where = `players[${id}]`;

      if (!/^-?\d+$/.test(id)) errors.push(`${where}: the key must be a player id.`);
      if (!isObject(value)) {
        errors.push(`${where}: not an object.`);
        continue;
      }

      const entry = value as Record<string, unknown>;
      if (!(AVAILABILITY_STATUSES as readonly unknown[]).includes(entry.status)) {
        errors.push(`${where}: unknown status ${JSON.stringify(entry.status)}.`);
      }
      if (!isNullableString(entry.injury)) errors.push(`${where}: injury must be text or null.`);
      if (!isNullableString(entry.returnText)) errors.push(`${where}: returnText must be text or null.`);
      if (!isNullableNumber(entry.returnWeeks)) errors.push(`${where}: returnWeeks must be a number or null.`);
      if (!isNullableNumber(entry.returnRound)) errors.push(`${where}: returnRound must be a number or null.`);
      if (!(entry.selected === null || typeof entry.selected === "boolean")) {
        errors.push(`${where}: selected must be true, false or null.`);
      }
      if (typeof entry.asOf !== "string" || !DATE.test(entry.asOf)) errors.push(`${where}: asOf must be YYYY-MM-DD.`);
      if (typeof entry.source !== "string") errors.push(`${where}: source must be text.`);
    }
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, snapshot: raw as unknown as AvailabilitySnapshot };
}

/** Narrowing helper for callers that already validated. */
export function entryFor(
  snapshot: AvailabilitySnapshot | null,
  playerId: number,
): PlayerAvailability | undefined {
  return snapshot?.players[String(playerId)];
}
