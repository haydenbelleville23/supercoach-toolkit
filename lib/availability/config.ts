import type { AvailabilityStatus } from "./types";

/**
 * Every availability rule and threshold in one place.
 */

/** 1 to this many weeks out is short-term. */
export const SHORT_TERM_MAX_WEEKS = 3;

/** This many weeks or more out is long-term. */
export const LONG_TERM_MIN_WEEKS = 4;

/** A snapshot older than this many days is stale (badges greyed). */
export const STALE_AFTER_DAYS = 7;

/** Estimated-return words that mean long-term (matched as whole words). */
export const LONG_TERM_WORDS = ["season", "indefinite", "indefinitely"];

/** Estimated-return words that mean a fitness test this week. */
export const TEST_WORDS = ["test"];

/** Injury or return words that mean a suspension. */
export const SUSPENSION_WORDS = ["suspended", "suspension", "susp"];

/**
 * Footer credit for the injury list: renders "Injury information: {label}"
 * only when set. Empty until a source is chosen.
 */
export const AVAILABILITY_SOURCE_LABEL = "";

/**
 * SuperCoach's injury_suspension_status values with a known meaning
 * (lowercase). Empty: no mid-season value has been seen yet, so every
 * non-empty value is "unknown" until it's added here. The import script
 * logs every value it sees.
 */
export const SUPERCOACH_STATUS_MAP: Record<string, AvailabilityStatus> = {};

/** Source label for entries taken from SuperCoach's own fields. */
export const SUPERCOACH_SOURCE = "SuperCoach public player data";
