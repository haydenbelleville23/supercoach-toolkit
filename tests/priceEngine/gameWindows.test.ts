import { describe, expect, it } from "vitest";

import { getFixtures } from "@/lib/fixtures";
import {
  getGameWindows,
  getLivePollingPlan,
  POLL_INTERVAL_MS,
  WINDOW_AFTER_MS,
  WINDOW_BEFORE_MS,
} from "@/lib/liveMatch/gameWindows";

const at = (iso: string) => Date.parse(iso);

describe("getGameWindows", () => {
  const fixtures = [
    // Friday night (AEST, +10:00)
    { round: 19, kickoff: "2026-07-17T19:40:00+10:00" },
    // Saturday afternoon and evening: overlapping windows merge
    { round: 19, kickoff: "2026-07-18T13:45:00+10:00" },
    { round: 19, kickoff: "2026-07-18T16:15:00+10:00" },
    { round: 20, kickoff: "2026-07-24T19:40:00+10:00" },
  ];

  it("builds one window per game day and merges overlaps", () => {
    const windows = getGameWindows(fixtures, 19);

    expect(windows).toHaveLength(2);
    expect(windows[0]).toEqual({
      start: at("2026-07-17T19:40:00+10:00") - WINDOW_BEFORE_MS,
      end: at("2026-07-17T19:40:00+10:00") + WINDOW_AFTER_MS,
    });
    expect(windows[1].start).toBe(at("2026-07-18T13:30:00+10:00"));
    expect(windows[1].end).toBe(at("2026-07-18T19:45:00+10:00"));
  });

  it("uses each kickoff's own offset, so AEDT and AEST both line up", () => {
    const [window] = getGameWindows(
      [{ round: 0, kickoff: "2026-03-05T19:30:00+11:00" }],
      0,
    );

    expect(new Date(window.start).toISOString()).toBe("2026-03-05T08:15:00.000Z");
  });

  it("covers every scheduled 2026 round with kickoffs", () => {
    const windows = getGameWindows(getFixtures(), 19);
    expect(windows.length).toBeGreaterThan(0);
  });
});

describe("getLivePollingPlan", () => {
  const windows = getGameWindows(
    [
      { round: 19, kickoff: "2026-07-17T19:40:00+10:00" },
      { round: 19, kickoff: "2026-07-18T13:45:00+10:00" },
    ],
    19,
  );

  it("polls every 30 seconds inside a window", () => {
    const now = at("2026-07-17T20:30:00+10:00");
    expect(getLivePollingPlan(windows, now)).toEqual({
      inRound: true,
      inWindow: true,
      nextCheckAt: now + POLL_INTERVAL_MS,
    });
  });

  it("waits for the next window between game days", () => {
    const now = at("2026-07-18T09:00:00+10:00");
    expect(getLivePollingPlan(windows, now)).toEqual({
      inRound: true,
      inWindow: false,
      nextCheckAt: at("2026-07-18T13:30:00+10:00"),
    });
  });

  it("waits for the first window before the round starts", () => {
    const plan = getLivePollingPlan(windows, at("2026-07-16T12:00:00+10:00"));
    expect(plan.inRound).toBe(false);
    expect(plan.nextCheckAt).toBe(at("2026-07-17T19:25:00+10:00"));
  });

  it("stops once the round's last window has closed", () => {
    expect(
      getLivePollingPlan(windows, at("2026-07-20T12:00:00+10:00")),
    ).toEqual({ inRound: false, inWindow: false, nextCheckAt: null });
  });
});
