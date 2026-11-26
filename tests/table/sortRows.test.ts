import { describe, expect, it } from "vitest";

import { compareSortValues, sortRows } from "@/lib/table/sortRows";

describe("compareSortValues", () => {
  it("orders numbers both ways", () => {
    expect([3, 1, 2].sort((a, b) => compareSortValues(a, b, "asc"))).toEqual([1, 2, 3]);
    expect([3, 1, 2].sort((a, b) => compareSortValues(a, b, "desc"))).toEqual([3, 2, 1]);
  });

  it("puts missing values last in both directions", () => {
    const values = [2, null, 5, undefined, Number.NaN, 1];

    expect(values.slice().sort((a, b) => compareSortValues(a, b, "asc")).slice(0, 3)).toEqual([1, 2, 5]);
    expect(values.slice().sort((a, b) => compareSortValues(a, b, "desc")).slice(0, 3)).toEqual([5, 2, 1]);

    for (const direction of ["asc", "desc"] as const) {
      const tail = values.slice().sort((a, b) => compareSortValues(a, b, direction)).slice(3);
      expect(tail.every((v) => v === null || v === undefined || Number.isNaN(v))).toBe(true);
    }
  });

  it("compares strings by locale, ignoring case, with numbers in order", () => {
    const names = ["bob", "Alice", "R10", "R2", "Émile"];
    expect(names.sort((a, b) => compareSortValues(a, b, "asc"))).toEqual(["Alice", "bob", "Émile", "R2", "R10"]);
  });

  it("puts numbers before strings when ascending", () => {
    expect(compareSortValues(5, "five", "asc")).toBeLessThan(0);
    expect(compareSortValues(5, "five", "desc")).toBeGreaterThan(0);
  });
});

describe("sortRows", () => {
  const rows = [
    { id: "a", gain: 10 },
    { id: "b", gain: 20 },
    { id: "c", gain: 10 },
    { id: "d", gain: null },
    { id: "e", gain: 20 },
  ];

  it("is stable for ties in both directions", () => {
    expect(sortRows(rows, (r) => r.gain, "asc").map((r) => r.id)).toEqual(["a", "c", "b", "e", "d"]);
    expect(sortRows(rows, (r) => r.gain, "desc").map((r) => r.id)).toEqual(["b", "e", "a", "c", "d"]);
  });

  it("does not change the input", () => {
    const before = rows.map((r) => r.id);
    sortRows(rows, (r) => r.gain, "desc");
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});
