import { describe, expect, it } from "vitest";

import { matchesAvailabilityFilter } from "@/lib/availability/filter";
import {
  getAvailability,
  hasSelectionData,
  isLikelyPlaying,
  isStale,
} from "@/lib/availability/selectors";
import type { AvailabilitySnapshot, PlayerAvailability } from "@/lib/availability/types";

const entry = (status: PlayerAvailability["status"], extra: Partial<PlayerAvailability> = {}): PlayerAvailability => ({
  status,
  injury: "Knee",
  returnText: null,
  returnWeeks: null,
  returnRound: null,
  selected: null,
  asOf: "2026-05-19",
  source: "Test list",
  ...extra,
});

const snapshot: AvailabilitySnapshot = {
  season: 2026,
  asOf: "2026-05-19",
  round: 11,
  source: "Test list",
  players: {
    1: entry("long-term", { returnText: "Season" }),
    2: entry("long-term", { returnText: "4-6 weeks", returnWeeks: 6, returnRound: 17 }),
    3: entry("short-term", { returnText: "1-2 weeks", returnWeeks: 2, returnRound: 13 }),
    4: entry("suspended", { returnText: "1 match", returnWeeks: 1, returnRound: 12 }),
    5: entry("test", { returnText: "Test", returnRound: 12, selected: true }),
    6: entry("unknown", { returnText: "TBC" }),
    7: entry("available", { injury: null, selected: false }),
  },
};

const p = (id: number, availability: string | null = null) => ({ id, availability });

describe("getAvailability", () => {
  it("applies the status until the return round, then available", () => {
    expect(getAvailability(p(3), 11, snapshot)?.status).toBe("short-term");
    expect(getAvailability(p(3), 12, snapshot)?.status).toBe("short-term");
    expect(getAvailability(p(3), 13, snapshot)?.status).toBe("available");
    expect(getAvailability(p(4), 12, snapshot)?.status).toBe("available");
    expect(getAvailability(p(2), 16, snapshot)?.status).toBe("long-term");
    expect(getAvailability(p(2), 17, snapshot)?.status).toBe("available");
  });

  it("keeps long-term with no return round out for every later round", () => {
    for (const round of [11, 15, 24]) {
      expect(getAvailability(p(1), round, snapshot)?.status).toBe("long-term");
    }
  });

  it("applies a test to the list's round only", () => {
    expect(getAvailability(p(5), 11, snapshot)?.status).toBe("test");
    expect(getAvailability(p(5), 12, snapshot)?.status).toBe("available");
  });

  it("treats a player not on a loaded list as available", () => {
    expect(getAvailability(p(99), 11, snapshot)?.status).toBe("available");
  });

  it("only reports 'selected' for the list's round", () => {
    expect(getAvailability(p(5), 11, snapshot)?.selected).toBe(true);
    expect(getAvailability(p(7), 11, snapshot)?.selected).toBe(false);
    expect(getAvailability(p(7), 12, snapshot)?.selected).toBeNull();
  });

  it("with no list: nothing, or the SuperCoach text as unknown", () => {
    expect(getAvailability(p(1), 11, null)).toBeNull();
    const fallback = getAvailability(p(1, "Hamstring"), 11, null)!;
    expect(fallback.status).toBe("unknown");
    expect(fallback.injury).toBe("Hamstring");
  });
});

describe("isLikelyPlaying", () => {
  it("is false for long-term and suspended until they return", () => {
    expect(isLikelyPlaying(p(1), 11, snapshot)).toBe(false);
    expect(isLikelyPlaying(p(2), 11, snapshot)).toBe(false);
    expect(isLikelyPlaying(p(4), 11, snapshot)).toBe(false);
    expect(isLikelyPlaying(p(4), 12, snapshot)).toBe(true);
  });

  it("is true for test, short-term, unknown, available and no data", () => {
    for (const id of [3, 5, 6, 7, 99]) expect(isLikelyPlaying(p(id), 11, snapshot)).toBe(true);
    expect(isLikelyPlaying(p(1), 11, null)).toBe(true);
  });
});

describe("isStale", () => {
  it("is stale after 7 days, not on the 7th", () => {
    expect(isStale({ asOf: "2026-05-19" }, new Date("2026-05-26T12:00:00Z"))).toBe(false);
    expect(isStale({ asOf: "2026-05-19" }, new Date("2026-05-27T12:00:00Z"))).toBe(true);
  });

  it("never marks the sample or an undated fallback stale", () => {
    expect(isStale({ asOf: "2026-05-19", sample: true }, new Date("2026-11-27"))).toBe(false);
    expect(isStale({ asOf: "" }, new Date("2026-11-27"))).toBe(false);
  });
});

describe("Cash Cows status filter", () => {
  const ids = [1, 2, 3, 4, 5, 6, 7, 99];
  const pick = (filter: "all" | "available" | "selected", snap: AvailabilitySnapshot | null = snapshot) =>
    ids.filter((id) => matchesAvailabilityFilter(p(id), filter, 11, snap));

  it("All shows everyone", () => {
    expect(pick("all")).toEqual(ids);
  });

  it("Available leaves out long-term and suspended", () => {
    expect(pick("available")).toEqual([3, 5, 6, 7, 99]);
    expect(pick("available", null)).toEqual(ids);
  });

  it("Selected shows only selected === true", () => {
    expect(pick("selected")).toEqual([5]);
    expect(pick("selected", null)).toEqual([]);
  });

  it("knows whether any selection data is loaded", () => {
    expect(hasSelectionData(snapshot)).toBe(true);
    expect(hasSelectionData(null)).toBe(false);
    expect(hasSelectionData({ ...snapshot, players: { 1: entry("long-term") } })).toBe(false);
  });
});
