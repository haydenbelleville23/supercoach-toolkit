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
  return (
    <div>
      <label
        className="block text-sm font-semibold text-slate-300"
        htmlFor="player"
      >
        Player
      </label>

      <select
        id="player"
        value={selectedPlayerId}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
      >
        {players.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name} — {player.team}
          </option>
        ))}
      </select>
    </div>
  );
}