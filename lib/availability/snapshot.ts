import raw from "availability-snapshot";

import { validateAvailability } from "./validate";
import type { AvailabilitySnapshot } from "./types";

const result = validateAvailability(raw);

if (!result.ok) {
  // A broken file stops the build rather than showing half-right data.
  throw new Error(`Invalid availability data:\n- ${result.errors.join("\n- ")}`);
}

/**
 * The loaded availability list, or null when there's none. Under
 * DEBUG_AS_OF_ROUND this is the invented sample (sample: true).
 */
export const availabilitySnapshot: AvailabilitySnapshot | null = result.snapshot;
