import accuracyIndex from "@/data/2026/accuracy/index.json";

type AccuracyRound = {
  round: number;
  generatedAt: string;
  baseMN: number;
  k: number;
  effectiveMN: number;
  anchorTotal: number;
  poolSize: number;
  playersCompared: number;
  avgAbsError: number;
  maxAbsError: number;
  within100Pct: number;
  estimatedBaseMN: number | null;
  warnings: string[];
};

const index = accuracyIndex as {
  season: number;
  updatedAt: string;
  rounds: AccuracyRound[];
};

const money = (value: number) =>
  `$${Math.round(value).toLocaleString("en-AU")}`;

/**
 * Weekly accuracy log from scripts/accuracy-log.ts: how closely the scaled
 * model matched each round's published prices.
 */
export default function AccuracyLogTable() {
  return (
    <section className="mt-8 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 px-4 py-4 sm:px-5">
        <h2 className="font-semibold text-white">
          Accuracy Log
        </h2>

        <p className="mt-1 text-xs text-slate-400">
          Scaled model vs published {index.season} prices, from{" "}
          <code>npm run accuracy:log</code>. Alerts: average error over $50,
          largest over $300, under 90% within $100, or baseMN drift over 10.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 text-left font-semibold">Round</th>
              <th className="px-4 py-3 text-right font-semibold">Players</th>
              <th className="px-4 py-3 text-right font-semibold">Avg Error</th>
              <th className="px-4 py-3 text-right font-semibold">Max Error</th>
              <th className="px-4 py-3 text-right font-semibold">Within $100</th>
              <th className="px-4 py-3 text-right font-semibold">k</th>
              <th className="px-4 py-3 text-right font-semibold">Effective MN</th>
              <th className="px-4 py-3 text-right font-semibold">Est. Base MN</th>
              <th className="px-4 py-3 text-right font-semibold">Pool</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>

          <tbody>
            {index.rounds.map((row) => (
              <tr
                key={row.round}
                className="border-b border-slate-800/80 last:border-b-0"
              >
                <td className="px-4 py-3 font-semibold text-white">
                  Round {row.round}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                  {row.playersCompared}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                  ${row.avgAbsError.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                  {money(row.maxAbsError)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                  {(row.within100Pct * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                  {row.k.toFixed(5)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                  {row.effectiveMN.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                  {row.estimatedBaseMN?.toFixed(1) ?? "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                  {row.poolSize} · {money(row.anchorTotal)}
                </td>
                <td
                  className={`px-4 py-3 text-xs font-semibold ${
                    row.warnings.length === 0
                      ? "text-emerald-400"
                      : "whitespace-normal text-amber-400"
                  }`}
                  title={row.warnings.join("; ")}
                >
                  {row.warnings.length === 0
                    ? "OK"
                    : row.warnings.join("; ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
