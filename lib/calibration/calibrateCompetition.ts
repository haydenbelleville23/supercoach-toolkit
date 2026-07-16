import { createSnapshot } from "@/lib/snapshots/createSnapshot";
import { calibratePlayer } from "./calibration";

export function calibrateCompetition() {
  return createSnapshot()
    .map((record) => calibratePlayer(record.player))
    .filter(Boolean);
}