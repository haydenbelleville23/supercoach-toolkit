export type ProjectionMode =
  | "projected"
  | "season-average"
  | "three-round-average"
  | "five-round-average";

export const PROJECTION_MODES: readonly ProjectionMode[] = [
  "projected",
  "season-average",
  "three-round-average",
  "five-round-average",
];

/**
 * A mode from a saved setting or a link. The old "custom" mode (removed:
 * edits now work in every mode) and anything unknown become "projected".
 */
export function parseProjectionMode(value: unknown): ProjectionMode {
  return PROJECTION_MODES.includes(value as ProjectionMode)
    ? (value as ProjectionMode)
    : "projected";
}