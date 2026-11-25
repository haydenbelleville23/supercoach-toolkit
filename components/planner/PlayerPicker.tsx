"use client";

import { useState } from "react";

import type { Player } from "@/types/player";

import { playerLabel } from "./plannerData";

/** One shared suggestion list for every picker on the page. */
export function PlayerOptions({ id, players }: { id: string; players: Player[] }) {
  return (
    <datalist id={id}>
      {players.map((player) => (
        <option key={player.id} value={playerLabel(player)} />
      ))}
    </datalist>
  );
}

/**
 * Text box using a shared suggestion list (native datalist, phone
 * friendly). Typing or picking a full label selects that player.
 */
export default function PlayerPicker({
  listId,
  label,
  players,
  selected,
  onSelect,
}: {
  listId: string;
  label: string;
  players: Map<string, Player>;
  selected: Player | null;
  onSelect: (playerId: number | null) => void;
}) {
  const [text, setText] = useState(selected ? playerLabel(selected) : "");

  return (
    <input
      type="text"
      list={listId}
      aria-label={label}
      placeholder={label}
      value={text}
      onChange={(event) => {
        const value = event.target.value;
        setText(value);

        if (value === "") {
          onSelect(null);
          return;
        }

        const match = players.get(value);
        if (match) {
          onSelect(match.id);
        }
      }}
      className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm outline-none focus:border-violet-500"
    />
  );
}
