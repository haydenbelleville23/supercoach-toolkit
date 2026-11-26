"use client";

import PlayerSelect from "@/components/ui/PlayerSelect";
import type { Player } from "@/types/player";

type PlayerSearchBarProps = {
  players: Player[];
  selectedPlayer: Player;
  onChange: (playerId: number) => void;
};

/**
 * The Projector's player search (44px): the shared PlayerSelect. While
 * closed it shows the selected player's short name (full name from sm up)
 * and team badge; focusing it opens the search.
 */
export default function PlayerSearchBar({
  players,
  selectedPlayer,
  onChange,
}: PlayerSearchBarProps) {
  return (
    <PlayerSelect
      idPrefix="player"
      label="Search player"
      players={players}
      value={selectedPlayer}
      onSelect={(player) => onChange(player.id)}
    />
  );
}
