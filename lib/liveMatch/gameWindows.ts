/**
 * When to poll the live-score feed, from real kickoff times.
 *
 * Kickoffs in fixtures-raw.json carry their own UTC offset (+10:00 AEST or
 * +11:00 AEDT), so Date.parse gives the exact instant whatever the viewer's
 * timezone or daylight saving.
 */

export interface GameWindow {
  start: number;
  end: number;
}

export interface WindowFixture {
  round: number;
  kickoff: string | null;
}

/** Start polling this long before a kickoff. */
export const WINDOW_BEFORE_MS = 15 * 60 * 1000;

/** Keep polling this long after a kickoff (a game plus delays). */
export const WINDOW_AFTER_MS = 3.5 * 60 * 60 * 1000;

/** How often to poll inside a window (matches the route's 30s cache). */
export const POLL_INTERVAL_MS = 30 * 1000;

/** One window per game, overlapping windows merged, in time order. */
export function getGameWindows(
  fixtures: WindowFixture[],
  round: number,
): GameWindow[] {
  const windows = fixtures
    .filter((fixture) => fixture.round === round && fixture.kickoff)
    .map((fixture) => {
      const kickoff = Date.parse(fixture.kickoff as string);

      return {
        start: kickoff - WINDOW_BEFORE_MS,
        end: kickoff + WINDOW_AFTER_MS,
      };
    })
    .filter((window) => Number.isFinite(window.start))
    .sort((a, b) => a.start - b.start);

  const merged: GameWindow[] = [];

  for (const window of windows) {
    const last = merged[merged.length - 1];

    if (last && window.start <= last.end) {
      last.end = Math.max(last.end, window.end);
    } else {
      merged.push({ ...window });
    }
  }

  return merged;
}

export interface LivePollingPlan {
  /** Between the round's first window opening and its last closing. */
  inRound: boolean;
  /** Inside a game window right now. */
  inWindow: boolean;
  /** When to check again, or null if the round's windows are all over. */
  nextCheckAt: number | null;
}

export function getLivePollingPlan(
  windows: GameWindow[],
  now: number,
): LivePollingPlan {
  if (windows.length === 0) {
    return { inRound: false, inWindow: false, nextCheckAt: null };
  }

  const inRound =
    now >= windows[0].start && now <= windows[windows.length - 1].end;

  const inWindow = windows.some(
    (window) => now >= window.start && now <= window.end,
  );

  if (inWindow) {
    return { inRound, inWindow, nextCheckAt: now + POLL_INTERVAL_MS };
  }

  const nextWindow = windows.find((window) => window.start > now);

  return {
    inRound,
    inWindow,
    nextCheckAt: nextWindow ? nextWindow.start : null,
  };
}
