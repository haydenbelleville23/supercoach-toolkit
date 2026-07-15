import { getPlayers, getPlayerById } from "@/lib/players";

import type { Player } from "@/types/player";

export class PlayerRepository {
  getAll(): Player[] {
    return getPlayers();
  }

  getById(id: number): Player | undefined {
    return getPlayerById(id);
  }

  search(query: string): Player[] {
    const lower = query.toLowerCase();

    return getPlayers().filter((player) =>
      player.name.toLowerCase().includes(lower),
    );
  }
}

export const playerRepository =
  new PlayerRepository();