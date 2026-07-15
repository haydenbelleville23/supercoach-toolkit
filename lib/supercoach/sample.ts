import samplePlayer from "@/data/supercoach-player-sample.json";
import type { SuperCoachPlayer } from "@/types/supercoach";

import { normaliseSuperCoachPlayer } from "./normalisePlayer";

export const normalisedSamplePlayer = normaliseSuperCoachPlayer(
  samplePlayer as SuperCoachPlayer,
);