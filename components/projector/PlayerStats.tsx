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
  const stats = [
    {
      label: "Price",
      value: `$${price.toLocaleString()}`,
    },
    {
      label: "BE",
      value: breakeven.toString(),
    },
    {
      label: "Games",
      value: games.toString(),
    },
    {
      label: "Average",
      value: average.toFixed(1),
    },
    {
      label: "3RA",
      value: average3.toFixed(1),
    },
    {
      label: "5RA",
      value: average5.toFixed(1),
    },
    {
      label: "Owned",
      value: `${ownership.toFixed(1)}%`,
    },
  ];

  return (
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg bg-slate-950 px-3 py-2"
        >
          <p className="text-xs text-slate-500">
            {stat.label}
          </p>

          <p className="mt-0.5 font-semibold tabular-nums">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}