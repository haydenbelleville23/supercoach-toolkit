"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

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
    players.find(
      (player) =>
        player.id === selectedPlayerId,
    ) ?? players[0];

  const [query, setQuery] = useState(
    selectedPlayer?.name ?? "",
  );

  const [isOpen, setIsOpen] =
    useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedPlayer?.name ?? "");
    }
  }, [selectedPlayer, isOpen]);

  const filteredPlayers = useMemo(() => {
    const cleanedQuery =
      query.trim().toLowerCase();

    if (!cleanedQuery) {
      return players.slice(0, 20);
    }

    return players
      .filter((player) => {
        const searchableText = [
          player.name,
          player.team,
          player.teamName,
          ...player.positions,
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          cleanedQuery,
        );
      })
      .slice(0, 20);
  }, [players, query]);

  function selectPlayer(player: Player) {
    onChange(player.id);
    setQuery(player.name);
    setIsOpen(false);
  }

  function closeSelector() {
    setIsOpen(false);
    setQuery(selectedPlayer?.name ?? "");
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
        autoComplete="off"
        onFocus={(event) => {
          setIsOpen(true);
          setQuery("");
          event.currentTarget.select();
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(
            closeSelector,
            150,
          );
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            closeSelector();
            event.currentTarget.blur();
          }

          if (
            event.key === "Enter" &&
            filteredPlayers.length > 0
          ) {
            event.preventDefault();
            selectPlayer(
              filteredPlayers[0],
            );
          }
        }}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-500"
      />

      {isOpen && (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 shadow-xl">
          {filteredPlayers.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">
              No players found.
            </p>
          ) : (
            filteredPlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() =>
                  selectPlayer(player)
                }
                className="flex w-full items-center gap-3 border-b border-slate-800 px-4 py-3 text-left last:border-b-0 hover:bg-slate-900"
              >
                <Image
                  src={getTeamLogo(
                    player.team,
                  )}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 object-contain"
                />

                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {player.name}
                  </span>

                  <span className="block text-xs text-slate-500">
                    {player.team}
                    {" · "}
                    {player.positions.join("/")}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}