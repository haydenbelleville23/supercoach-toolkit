"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { getTeamLogo } from "@/lib/teams";
import type { Player } from "@/types/player";

type PlayerSelectorProps = {
  players: Player[];
  selectedPlayerId: number;
  onChange: (playerId: number) => void;
};

export default function PlayerSelector({
  players,
  selectedPlayerId,
  onChange,
}: PlayerSelectorProps) {
  const selectedPlayer =
    players.find((player) => player.id === selectedPlayerId) ?? players[0];

  const [query, setQuery] = useState(selectedPlayer.name);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedPlayer.name);
  }, [selectedPlayer.name]);

  const filteredPlayers = useMemo(() => {
    const cleanedQuery = query.trim().toLowerCase();

    if (!cleanedQuery) {
      return players.slice(0, 10);
    }

    return players
      .filter((player) =>
        player.name.toLowerCase().includes(cleanedQuery),
      )
      .slice(0, 10);
  }, [players, query]);

  function selectPlayer(player: Player) {
    onChange(player.id);
    setQuery(player.name);
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <label
        htmlFor="player-search"
        className="block text-sm font-semibold text-slate-300"
      >
        Search player
      </label>

      <input
        id="player-search"
        type="text"
        value={query}
        placeholder="Search player..."
        onFocus={() => setIsOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
            setQuery(selectedPlayer.name);
          }

          if (
            event.key === "Enter" &&
            filteredPlayers.length > 0
          ) {
            selectPlayer(filteredPlayers[0]);
          }
        }}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-500"
      />

      {isOpen && (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 shadow-xl">
          {filteredPlayers.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">
              No players found.
            </p>
          ) : (
            filteredPlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => selectPlayer(player)}
                className="flex w-full items-center gap-3 border-b border-slate-800 px-4 py-3 text-left last:border-b-0 hover:bg-slate-900"
              >
                <Image
                  src={getTeamLogo(player.team)}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 object-contain"
                />

                <span className="font-medium">
                  {player.name}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}