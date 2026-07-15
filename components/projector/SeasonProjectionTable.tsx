import type { SeasonProjectionRow } from "@/types/projection";

type SeasonProjectionTableProps = {
  rows: SeasonProjectionRow[];
  onScoreChange: (round: number, score: number | null) => void;
  onPlayedChange: (round: number, played: boolean) => void;
};

function formatMoney(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return `$${value.toLocaleString()}`;
}

export default function SeasonProjectionTable({
  rows,
  onScoreChange,
  onPlayedChange,
}: SeasonProjectionTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
      <table className="min-w-[900px] w-full text-sm">
        <thead className="sticky top-0 bg-slate-950 text-left text-slate-400">
          <tr>
            <th className="px-4 py-3">Round</th>
            <th className="px-4 py-3 text-center">Playing</th>
            <th className="px-4 py-3 text-right">Score</th>
            <th className="px-4 py-3 text-right">Magic No.</th>
            <th className="px-4 py-3 text-right">BE</th>
            <th className="px-4 py-3 text-right">Price</th>
            <th className="px-4 py-3 text-right">Change</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const positiveChange =
              row.priceChange !== null && row.priceChange >= 0;

            return (
              <tr
                key={row.round}
                className={`border-t border-slate-800 ${
                  row.isActual ? "bg-slate-950/40" : ""
                }`}
              >
                <td className="px-4 py-3 font-semibold">
                  {row.round === 0 ? "Opening" : `Round ${row.round}`}
                </td>

                <td className="px-4 py-3 text-center">
                  {row.isActual ? (
                    <span className="text-slate-500">Actual</span>
                  ) : (
                    <input
                      type="checkbox"
                      checked={row.played}
                      onChange={(event) =>
                        onPlayedChange(row.round, event.target.checked)
                      }
                      className="h-4 w-4"
                    />
                  )}
                </td>

                <td className="px-4 py-3 text-right">
                  {row.isActual ? (
                    row.score ?? "—"
                  ) : (
                    <input
                      type="number"
                      min="0"
                      max="250"
                      disabled={!row.played}
                      value={row.score ?? ""}
                      onChange={(event) =>
                        onScoreChange(
                          row.round,
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        )
                      }
                      className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-right disabled:opacity-40"
                    />
                  )}
                </td>

                <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                    {row.magicNumber.toLocaleString()}
                </td>

                <td className="px-4 py-3 text-right">
                  {row.breakEven === null
                    ? "—"
                    : Math.ceil(row.breakEven)}
                </td>

                <td className="px-4 py-3 text-right font-semibold">
                  {formatMoney(row.price)}
                </td>

                <td
                  className={`px-4 py-3 text-right ${
                    row.priceChange === null
                      ? "text-slate-500"
                      : positiveChange
                        ? "text-emerald-400"
                        : "text-red-400"
                  }`}
                >
                  {row.priceChange === null
                    ? "—"
                    : `${positiveChange ? "+" : "−"}${formatMoney(
                        Math.abs(row.priceChange),
                      )}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}