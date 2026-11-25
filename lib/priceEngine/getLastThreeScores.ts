import type { PlayerHistoryRow } from "@/types/player";

export function getLastThreeScores(
  history: PlayerHistoryRow[],
  round: number,
): [number, number, number] | null {
  const scores = history
    .filter(
      (row) =>
        row.round <= round &&
        row.score !== null,
    )
    .map((row) => row.score as number);

  if (scores.length < 3) {
    return null;
  }

  return scores.slice(-3) as [
    number,
    number,
    number,
  ];
}