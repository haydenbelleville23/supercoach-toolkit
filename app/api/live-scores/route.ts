import { NextResponse } from "next/server";

import { DEBUG_AS_OF_ROUND } from "@/lib/asOf/debugAsOfRound";
import {
  normaliseDfsLiveFeed,
} from "@/lib/liveMatch/dfsAustralia";

const DFS_LIVE_URL =
  "https://dfsaustralia-apps.com/shiny/afl-live-scoring/liveScoring2026.json";

export const revalidate = 30;

export async function GET() {
  // DEBUG_AS_OF_ROUND: the live feed is ignored, and never fetched.
  if (DEBUG_AS_OF_ROUND !== null) {
    return NextResponse.json(
      {
        error: `Live scores are off while viewing as of Round ${DEBUG_AS_OF_ROUND}.`,
      },
      {
        status: 503,
      },
    );
  }

  try {
    const response = await fetch(
      DFS_LIVE_URL,
      {
        headers: {
          Accept: "application/json",
        },
        next: {
          revalidate: 30,
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            "The external live-score feed was unavailable.",
        },
        {
          status: 502,
        },
      );
    }

    const raw = await response.json();

    const feed = normaliseDfsLiveFeed(raw);

    return NextResponse.json(feed, {
      headers: {
        "Cache-Control":
          "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error(
      "Could not load the live-score feed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "The live-score feed could not be loaded.",
      },
      {
        status: 502,
      },
    );
  }
}