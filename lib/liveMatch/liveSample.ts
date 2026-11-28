import raw from "live-sample-feed";

import { normaliseDfsLiveFeed, type DfsLiveFeed, type RawDfsFeed } from "./dfsAustralia";

/**
 * The invented sample live feed, normalised like the real one. Only ever
 * non-null under DEBUG_AS_OF_ROUND (see sampleAlias.ts); null in
 * production and in tests.
 */
export const liveSampleFeed: DfsLiveFeed | null =
  raw !== null &&
  typeof raw === "object" &&
  Array.isArray((raw as RawDfsFeed).playerStats)
    ? normaliseDfsLiveFeed(raw as RawDfsFeed)
    : null;
