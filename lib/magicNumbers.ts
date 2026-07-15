import { magicNumbers } from "@/data/magicNumbers";

const DEFAULT_MAGIC_NUMBER = 5000;

export function getMagicNumber(round: number): number {
  const exactEntry = magicNumbers.find(
    (entry) => entry.round === round,
  );

  if (exactEntry) {
    return exactEntry.value;
  }

  const latestEarlierEntry = magicNumbers
    .filter((entry) => entry.round < round)
    .sort((a, b) => b.round - a.round)[0];

  return latestEarlierEntry?.value ?? DEFAULT_MAGIC_NUMBER;
}