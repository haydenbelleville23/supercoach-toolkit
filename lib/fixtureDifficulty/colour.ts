import { POSITION_COLOUR_THRESHOLD, TEAM_NET_COLOUR_THRESHOLD } from "./config";

export type DifficultyBand = "easy" | "neutral" | "hard";

/** Above +threshold easy, below -threshold hard, otherwise (or no value) neutral. */
export function difficultyBand(value: number | null, threshold = POSITION_COLOUR_THRESHOLD): DifficultyBand {
  if (value === null || Number.isNaN(value)) return "neutral";
  if (value > threshold) return "easy";
  if (value < -threshold) return "hard";
  return "neutral";
}

/** Teams view: Net (Against minus For) against its own threshold. */
export function teamNetBand(net: number): DifficultyBand {
  return difficultyBand(net, TEAM_NET_COLOUR_THRESHOLD);
}

/** "+2.3", "−1.0", "0.0" (true minus sign). */
export function formatSigned(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return "-";
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return (0).toFixed(digits);
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(digits)}`;
}
