import type { DfsLiveFixture } from "./dfsAustralia";

export type FixtureState = "live" | "finished" | "upcoming";

/**
 * Normalises the feed's status. The feed reports finished games as
 * CONCLUDED or POSTGAME (and progress reaches 100); anything else that is not
 * LIVE has not started.
 */
export function getFixtureState(fixture: DfsLiveFixture): FixtureState {
  if (
    fixture.status === "CONCLUDED" ||
    fixture.status === "POSTGAME" ||
    fixture.progress >= 100
  ) {
    return "finished";
  }

  if (fixture.status === "LIVE") {
    return "live";
  }

  return "upcoming";
}
