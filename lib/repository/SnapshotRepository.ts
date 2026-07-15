import { createSnapshot } from "@/lib/snapshots/createSnapshot";

import type { PlayerRecord } from "@/types/playerRecord";

export class SnapshotRepository {
  latest(): PlayerRecord[] {
    return createSnapshot();
  }
}

export const snapshotRepository =
  new SnapshotRepository();