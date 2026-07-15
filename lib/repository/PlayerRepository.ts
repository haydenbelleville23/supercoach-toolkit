import { getPlayers } from "@/lib/players";

import type { Player } from "@/types/player";

export class PlayerRepository {
  private readonly players: Player[];

  constructor(players: Player[]) {
    this.players = players;
  }

  getAll(): Player[] {
    return this.players;
  }

  getById(id: number): Player | undefined {
    return this.players.find(
      (player) => player.id === id,
    );
  }

  search(query: string): Player[] {
    const search = query.trim().toLowerCase();

    if (search === "") {
      return this.players;
    }

    return this.players.filter((player) =>
      player.name.toLowerCase().includes(search),
    );
  }

  getByTeam(team: string): Player[] {
    return this.players.filter(
      (player) => player.team === team,
    );
  }

  getByPosition(position: string): Player[] {
    return this.players.filter((player) =>
      player.positions.includes(position),
    );
  }
}

export const playerRepository =
  new PlayerRepository(getPlayers());