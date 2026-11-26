/**
 * Pure sorting for DataTable and pages that sort their own rows (for
 * example Cash Cows, which sorts the whole list before paging).
 */

export type SortDirection = "asc" | "desc";

export type SortValue = number | string | null | undefined;

export type SortState = {
  columnId: string;
  direction: SortDirection;
};

function isMissing(value: SortValue): value is null | undefined {
  return value === null || value === undefined || Number.isNaN(value);
}

const collator = new Intl.Collator("en-AU", {
  numeric: true,
  sensitivity: "base",
});

/**
 * Compares two sort values in the given direction.
 *
 * - Missing values (null, undefined, NaN) always sort last, whichever
 *   way the column is sorted.
 * - Numbers compare numerically; strings compare by locale, ignoring case
 *   and accents, with numbers inside strings in numeric order ("R2" < "R10").
 * - A number and a string: numbers come first when ascending.
 */
export function compareSortValues(
  a: SortValue,
  b: SortValue,
  direction: SortDirection = "asc",
): number {
  const aMissing = isMissing(a);
  const bMissing = isMissing(b);

  if (aMissing || bMissing) {
    return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
  }

  let result: number;

  if (typeof a === "number" && typeof b === "number") {
    result = a - b;
  } else if (typeof a === "string" && typeof b === "string") {
    result = collator.compare(a, b);
  } else {
    result = typeof a === "number" ? -1 : 1;
  }

  return direction === "asc" ? result : -result;
}

/**
 * Returns a new array sorted by `getValue`. Stable: rows with equal values
 * keep their original order, in both directions.
 */
export function sortRows<Row>(
  rows: readonly Row[],
  getValue: (row: Row) => SortValue,
  direction: SortDirection,
): Row[] {
  return rows
    .map((row, index) => ({ row, index, value: getValue(row) }))
    .sort(
      (a, b) =>
        compareSortValues(a.value, b.value, direction) || a.index - b.index,
    )
    .map((item) => item.row);
}
