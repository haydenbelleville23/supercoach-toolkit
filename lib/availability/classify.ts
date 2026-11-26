import {
  LONG_TERM_MIN_WEEKS,
  LONG_TERM_WORDS,
  SHORT_TERM_MAX_WEEKS,
  SUSPENSION_WORDS,
  TEST_WORDS,
} from "./config";
import { AVAILABILITY_STATUSES, type AvailabilityStatus } from "./types";

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

const words = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);

const hasWord = (text: string | null, list: readonly string[]) =>
  text ? words(text).some((word) => list.includes(word)) : false;

/**
 * Weeks out from an estimated return, taking the upper end of a range:
 * "1-2 weeks" -> 2, "3 weeks" -> 3, "2 matches" -> 2, "two weeks" -> 2,
 * "4" -> 4. Null for "Season", "TBC", blank or anything else.
 */
export function parseReturnWeeks(text: string | null): number | null {
  if (!text) return null;

  let t = text.toLowerCase();
  for (const [word, n] of Object.entries(NUMBER_WORDS)) {
    t = t.replace(new RegExp(`\\b${word}\\b`, "g"), String(n));
  }

  const unit = "(?:weeks?|wks?|w|match(?:es)?|games?|rounds?|rds?)";
  const range = t.match(new RegExp(`(\\d+)\\s*(?:-|–|to)\\s*(\\d+)\\s*${unit}?`));
  if (range) return Math.max(Number(range[1]), Number(range[2]));

  const single = t.match(new RegExp(`(\\d+)\\s*${unit}\\b`)) ?? t.match(/^\s*(\d+)\s*$/);
  if (single) return Number(single[1]);

  return null;
}

export interface Classification {
  status: AvailabilityStatus;
  returnWeeks: number | null;
}

/**
 * Status from a weekly list row. In order:
 *
 * 1. A valid status override wins. No injury and no return: available.
 * 2. "Suspended"/"Suspension" in the injury or return: suspended, with its
 *    weeks (or matches).
 * 3. "Test": test.
 * 4. "Season" or "Indefinite": long-term.
 * 5. Weeks: 1-3 short-term, 4+ long-term (thresholds in config).
 * 6. Anything else ("TBC", blank, unparseable): unknown, never out.
 */
export function classifyReturn({
  injury,
  returnText,
  override,
}: {
  injury: string | null;
  returnText: string | null;
  override?: string | null;
}): Classification {
  const weeks = parseReturnWeeks(returnText);
  const forced = override?.trim().toLowerCase();

  if (forced && (AVAILABILITY_STATUSES as readonly string[]).includes(forced)) {
    return { status: forced as AvailabilityStatus, returnWeeks: weeks };
  }

  // No injury and no return (e.g. a row only marking "selected").
  if (!injury?.trim() && !returnText?.trim()) {
    return { status: "available", returnWeeks: null };
  }

  if (hasWord(injury, SUSPENSION_WORDS) || hasWord(returnText, SUSPENSION_WORDS)) {
    return { status: "suspended", returnWeeks: weeks };
  }

  if (hasWord(returnText, TEST_WORDS)) {
    return { status: "test", returnWeeks: null };
  }

  if (hasWord(returnText, LONG_TERM_WORDS)) {
    return { status: "long-term", returnWeeks: null };
  }

  if (weeks !== null && weeks >= LONG_TERM_MIN_WEEKS) {
    return { status: "long-term", returnWeeks: weeks };
  }

  if (weeks !== null && weeks >= 1 && weeks <= SHORT_TERM_MAX_WEEKS) {
    return { status: "short-term", returnWeeks: weeks };
  }

  return { status: "unknown", returnWeeks: weeks };
}

/**
 * First round back, from the round the list applies to. Weeks count as
 * rounds (a bye in between isn't allowed for). A test applies to that
 * round only. Null when there's no number to go on.
 */
export function returnRoundFor(
  status: AvailabilityStatus,
  returnWeeks: number | null,
  listRound: number,
): number | null {
  if (status === "test") return listRound + 1;
  if (status === "available" || status === "unknown") return null;
  return returnWeeks === null ? null : listRound + returnWeeks;
}
