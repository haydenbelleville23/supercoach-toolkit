/**
 * Display-only severity for the planner's warning messages. The planner
 * produces plain sentences; this sorts them by wording so the round header
 * can show errors first. It changes no validation.
 *
 * error: invalid squad, over the trade limit, cash below zero, a trade
 *   missing a player, a player not in (or already in) the squad, a
 *   position problem.
 * warning: fewer than 18 playing in a bye round; injured or suspended
 *   players not counted.
 * info: anything else.
 */
export type WarningSeverity = "error" | "warning" | "info";

const ERROR_PATTERNS = [
  /^The squad has \d+ players; it needs/, // invalid squad size
  /trades planned; this round allows/, // over the round limit
  /^The season trade pool is used up/, // over the season limit
  /^A boost is used but none are left/,
  /^Cash in bank is below zero/,
  /is missing a player (?:in|out)\./,
  /isn't in the squad\./,
  /is already in the squad\./,
  /is traded (?:in|out) twice\./,
  // Position problems from the squad check (not the "Byes:" check).
  /^(?!Byes:).*can only play/,
  /^(?!Byes:).*can't be placed/,
  /has no position in the data\./,
];

const WARNING_PATTERNS = [
  /^Only \d+ of your players are playing in Round \d+/,
  /injured or suspended players? not counted as playing/,
];

export function warningSeverity(message: string): WarningSeverity {
  if (ERROR_PATTERNS.some((pattern) => pattern.test(message))) return "error";
  if (WARNING_PATTERNS.some((pattern) => pattern.test(message))) return "warning";
  return "info";
}

export const SEVERITY_ORDER: readonly WarningSeverity[] = ["error", "warning", "info"];

/** Messages grouped by severity, in order; empty groups left out. */
export function groupWarnings(messages: readonly string[]): { severity: WarningSeverity; messages: string[] }[] {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    messages: messages.filter((m) => warningSeverity(m) === severity),
  })).filter((group) => group.messages.length > 0);
}
