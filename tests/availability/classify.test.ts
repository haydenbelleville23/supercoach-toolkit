import { describe, expect, it } from "vitest";

import { classifyReturn, parseReturnWeeks, returnRoundFor } from "@/lib/availability/classify";

const classify = (returnText: string | null, injury: string | null = "Hamstring", override?: string) =>
  classifyReturn({ injury, returnText, override });

describe("parseReturnWeeks", () => {
  it("reads weeks, ranges (upper end), matches and number words", () => {
    expect(parseReturnWeeks("1 week")).toBe(1);
    expect(parseReturnWeeks("1-2 weeks")).toBe(2);
    expect(parseReturnWeeks("2 – 3 weeks")).toBe(3);
    expect(parseReturnWeeks("3 to 5 wks")).toBe(5);
    expect(parseReturnWeeks("2 matches")).toBe(2);
    expect(parseReturnWeeks("two weeks")).toBe(2);
    expect(parseReturnWeeks("4")).toBe(4);
  });

  it("gives null for words, blanks and garbage", () => {
    for (const text of ["Season", "TBC", "Indefinite", "", null, "asdf", "Round 14?"]) {
      expect(parseReturnWeeks(text)).toBeNull();
    }
  });
});

describe("classifyReturn", () => {
  it("Test is test", () => {
    expect(classify("Test")).toEqual({ status: "test", returnWeeks: null });
    expect(classify("test")).toEqual({ status: "test", returnWeeks: null });
  });

  it("1-3 weeks is short-term, 4+ is long-term", () => {
    expect(classify("1 week")).toEqual({ status: "short-term", returnWeeks: 1 });
    expect(classify("2-3 weeks")).toEqual({ status: "short-term", returnWeeks: 3 });
    expect(classify("3-4 weeks")).toEqual({ status: "long-term", returnWeeks: 4 });
    expect(classify("6 weeks")).toEqual({ status: "long-term", returnWeeks: 6 });
  });

  it("Season and Indefinite are long-term", () => {
    expect(classify("Season")).toEqual({ status: "long-term", returnWeeks: null });
    expect(classify("Indefinite")).toEqual({ status: "long-term", returnWeeks: null });
  });

  it("TBC and anything unparseable are unknown, never out", () => {
    expect(classify("TBC").status).toBe("unknown");
    expect(classify("??").status).toBe("unknown");
    expect(classify("Round 14?").status).toBe("unknown");
    expect(classify("0 weeks").status).toBe("unknown");
  });

  it("suspensions are suspended with their weeks", () => {
    expect(classify("2 matches", "Suspension")).toEqual({ status: "suspended", returnWeeks: 2 });
    expect(classify("Suspended (1 match)", null)).toEqual({ status: "suspended", returnWeeks: 1 });
    expect(classify("TBC", "Suspension")).toEqual({ status: "suspended", returnWeeks: null });
  });

  it("a blank injury and return means available", () => {
    expect(classify("", "")).toEqual({ status: "available", returnWeeks: null });
    expect(classify(null, null)).toEqual({ status: "available", returnWeeks: null });
  });

  it("a valid status override wins; an invalid one is ignored", () => {
    expect(classify("1 week", "Knee", "long-term")).toEqual({ status: "long-term", returnWeeks: 1 });
    expect(classify("1 week", "Knee", "banana").status).toBe("short-term");
  });
});

describe("returnRoundFor", () => {
  it("adds the weeks to the list's round", () => {
    expect(returnRoundFor("short-term", 2, 11)).toBe(13);
    expect(returnRoundFor("suspended", 1, 11)).toBe(12);
    expect(returnRoundFor("long-term", 6, 11)).toBe(17);
  });

  it("is null without a number, and a test applies to that round only", () => {
    expect(returnRoundFor("long-term", null, 11)).toBeNull();
    expect(returnRoundFor("unknown", null, 11)).toBeNull();
    expect(returnRoundFor("test", null, 11)).toBe(12);
  });
});
