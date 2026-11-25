"use client";

import { useEffect, useMemo, useState } from "react";

import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import type { ScaledRoundContext } from "@/lib/priceEngine/estimateScaledRoundContexts";
import { getFixtures } from "@/lib/fixtures";
import { getScaledRoundContexts } from "@/lib/projector/getScaledRoundContexts";
import { playerRepository } from "@/lib/repository/PlayerRepository";

import { buildLiveRoundContext } from "./buildLiveRoundContext";
import type { DfsLiveFeed } from "./dfsAustralia";
import {
  getGameWindows,
  getLivePollingPlan,
} from "./gameWindows";

const LIVE_ROUND = CURRENT_COMPLETED_ROUND + 1;

/** setTimeout cannot wait longer than this (about 24.8 days). */
const MAX_TIMEOUT_MS = 2_147_483_647;

function isScheduledGame(
  homeTeam: string,
  awayTeam: string,
  round: number,
): boolean {
  return getFixtures().some(
    (fixture) =>
      fixture.round === round &&
      fixture.homeTeam === homeTeam &&
      fixture.awayTeam === awayTeam,
  );
}

export interface LiveRoundContextState {
  /** Round estimates, with the next round updated from finished games. */
  contexts: Map<number, ScaledRoundContext>;
  /** True while the live feed is active for this round. */
  isLive: boolean;
}

/**
 * Round estimates for the Projector and Cash Cows, with live scores from
 * /api/live-scores folded into the next round's k as games finish.
 *
 * Only fetches during the round: once when a page opens mid-round, then
 * every 30 seconds inside game windows (15 minutes before each kickoff to
 * 3.5 hours after), sleeping until the next window otherwise. If the feed
 * fails, is DORMANT or is not this round's games, the season-average
 * estimate is used and isLive is false.
 */
export function useLiveRoundContext(): LiveRoundContextState {
  const [feed, setFeed] = useState<DfsLiveFeed | null>(null);

  useEffect(() => {
    const windows = getGameWindows(getFixtures(), LIVE_ROUND);
    let cancelled = false;
    let timer: number | undefined;

    async function fetchFeed() {
      try {
        const response = await fetch("/api/live-scores", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as DfsLiveFeed;

        if (!cancelled && Array.isArray(data.fixtures)) {
          setFeed(data);
        }
      } catch {
        // Keep the last good feed (or the season-average estimate).
      }
    }

    function schedule(nextCheckAt: number | null) {
      if (cancelled || nextCheckAt === null) {
        return;
      }

      timer = window.setTimeout(
        tick,
        Math.min(Math.max(nextCheckAt - Date.now(), 0), MAX_TIMEOUT_MS),
      );
    }

    async function tick() {
      const plan = getLivePollingPlan(windows, Date.now());

      if (plan.inWindow && !document.hidden) {
        await fetchFeed();
      }

      schedule(plan.nextCheckAt);
    }

    async function start() {
      const plan = getLivePollingPlan(windows, Date.now());

      // Opened mid-round between game windows: pick up finished games once.
      if (plan.inRound) {
        await fetchFeed();
      }

      schedule(plan.nextCheckAt);
    }

    start();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return useMemo(() => {
    const contexts = getScaledRoundContexts();
    const baseContext = contexts.get(LIVE_ROUND);

    if (!feed || feed.status === "DORMANT" || !baseContext) {
      return { contexts, isLive: false };
    }

    const result = buildLiveRoundContext({
      baseContext,
      round: LIVE_ROUND,
      feed,
      players: playerRepository.getAll(),
      manualScores: {},
      isScheduledGame,
    });

    if (!result.feedIsThisRound) {
      return { contexts, isLive: false };
    }

    return {
      contexts: new Map(contexts).set(LIVE_ROUND, result.context),
      isLive: true,
    };
  }, [feed]);
}
