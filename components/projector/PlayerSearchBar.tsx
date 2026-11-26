"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

import { shortPlayerName } from "@/lib/players/shortName";
import { getTeamLogo } from "@/lib/teams";
import type { Player } from "@/types/player";

type PlayerSearchBarProps = {
  players: Player[];
  selectedPlayer: Player;
  onChange: (playerId: number) => void;
};

/**
 * Compact player search (44px). While closed it shows the selected
 * player's short name (full name from sm up) and team badge; focusing it
 * opens the search with the same matching as the old selector (name, team,
 * team name, positions; Enter picks the first match, Escape closes).
 */
export default function PlayerSearchBar({
  players,
  selectedPlayer,
  onChange,
}: PlayerSearchBarProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredPlayers = useMemo(() => {
    const cleanedQuery = query.trim().toLowerCase();

    if (!cleanedQuery) {
      return players;
    }

    return players.filter((player) =>
      [player.name, player.team, player.teamName, ...player.positions]
        .join(" ")
        .toLowerCase()
        .includes(cleanedQuery),
    );
  }, [players, query]);

  function selectPlayer(player: Player) {
    onChange(player.id);
    setQuery("");
    setIsOpen(false);
  }

  function close() {
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div className="relative min-w-0 flex-1">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      />

      <input
        id="player-search"
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="player-search-results"
        aria-label={`Search player (selected: ${selectedPlayer.name}, ${selectedPlayer.team})`}
        value={query}
        placeholder={isOpen ? "Search player..." : ""}
        autoComplete="off"
        onFocus={() => {
          setIsOpen(true);
          setQuery("");
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onBlur={() => window.setTimeout(close, 150)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            close();
            event.currentTarget.blur();
          }

          if (event.key === "Enter" && filteredPlayers.length > 0) {
            event.preventDefault();
            selectPlayer(filteredPlayers[0]);
          }
        }}
        className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-white outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
      />

      {/* The selected player, shown over the empty input while closed. */}
      {!isOpen && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-9 right-3 flex min-w-0 items-center gap-1.5 text-sm"
        >
          <span className="truncate font-semibold text-white">
            <span className="sm:hidden">{shortPlayerName(selectedPlayer.name)}</span>
            <span className="hidden sm:inline">{selectedPlayer.name}</span>
          </span>
          <span className="shrink-0 rounded bg-slate-800 px-1 text-[10px] font-bold leading-4 text-slate-300">
            {selectedPlayer.team}
          </span>
        </span>
      )}

      {isOpen && (
        <div
          id="player-search-results"
          role="listbox"
          aria-label="Players"
          className="absolute z-40 mt-1 max-h-72 w-full min-w-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 shadow-xl"
        >
          {filteredPlayers.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No players found.</p>
          ) : (
            filteredPlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                role="option"
                aria-selected={player.id === selectedPlayer.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectPlayer(player)}
                className={`flex w-full items-center gap-3 border-b border-slate-800 px-3 py-2.5 text-left transition last:border-b-0 ${
                  player.id === selectedPlayer.id
                    ? "bg-violet-500/10"
                    : "hover:bg-slate-900"
                }`}
              >
                <Image
                  src={getTeamLogo(player.team)}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0 object-contain"
                />

                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{player.name}</span>
                  <span className="block text-xs text-slate-400">
                    {player.teamName} • {player.positions.join(" / ")}
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
