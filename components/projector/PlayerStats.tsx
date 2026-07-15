type PlayerStatsProps = {
  price: number;
  average: number;
  breakeven: number;
};

export default function PlayerStats({
  price,
  average,
  breakeven,
}: PlayerStatsProps) {
  return (
    <div className="mt-6 grid grid-cols-3 gap-3">
      <Stat label="Price" value={`$${price.toLocaleString()}`} />
      <Stat label="Average" value={average.toString()} />
      <Stat label="Break-even" value={breakeven.toString()} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-950 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}