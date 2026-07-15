import type { CalibrationResult } from "@/types/calibration";

export function averageError(
  results: CalibrationResult[],
): number {
  if (results.length === 0) {
    return 0;
  }

  const total = results.reduce(
    (sum, result) => sum + Math.abs(result.difference),
    0,
  );

  return Math.round(total / results.length);
}