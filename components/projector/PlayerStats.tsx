import { formatMoney } from "@/lib/format";

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
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <Stat label="Price" value={formatMoney(price)} />
      <Stat label="Breakeven" value={breakeven.toString()} />
      <Stat label="Average" value={average.toFixed(1)} />
      <Stat label="Games" value={games.toString()} />
      <Stat label="3 Round Avg" value={average3.toFixed(1)} />
      <Stat label="5 Round Avg" value={average5.toFixed(1)} />
      <Stat label="Ownership" value={`${ownership.toFixed(1)}%`} />
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
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold tabular-nums text-white">
        {value}
      </p>
    </div>
  );
}