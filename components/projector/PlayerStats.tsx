type PlayerStatsProps = {
  price: number;
  breakeven: number;
  games: number;
  average: number;
  average3: number;
  average5: number;
  ownership: number;
};

export default function PlayerStats({
  price,
  breakeven,
  games,
  average,
  average3,
  average5,
  ownership,
}: PlayerStatsProps) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-x-16 gap-y-2 text-sm">
      <Stat label="Price" value={price.toLocaleString()} />
      <Stat label="Games" value={games.toString()} />

      <Stat label="BE" value={breakeven.toString()} />
      <Stat label="Avg" value={average.toFixed(1)} />

      <Stat label="3RA" value={average3.toFixed(1)} />
      <Stat label="5RA" value={average5.toFixed(1)} />

      <Stat
        label="Owned"
        value={`${ownership.toFixed(1)}%`}
      />
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between border-b border-slate-800 py-1">
      <span className="text-slate-400">{label}</span>

      <span className="font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}