type ProjectionResult = {
  round: number;
  score: number;
  price: number;
  change: number;
};

type ProjectionTableProps = {
  results: ProjectionResult[];
};

export default function ProjectionTable({
  results,
}: ProjectionTableProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-xl font-semibold">Projected prices</h2>

      {results.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
          Enter the expected scores and calculate the projection.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-sm text-slate-400">
              <tr>
                <th className="px-4 py-3">Round</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Change</th>
                <th className="px-4 py-3 text-right">Price</th>
              </tr>
            </thead>

            <tbody>
              {results.map((result) => (
                <tr
                  className="border-t border-slate-800"
                  key={result.round}
                >
                  <td className="px-4 py-4">+{result.round}</td>
                  <td className="px-4 py-4">{result.score}</td>

                  <td
                    className={`px-4 py-4 ${
                      result.change >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {result.change >= 0 ? "+" : "-"}$
                    {Math.abs(result.change).toLocaleString()}
                  </td>

                  <td className="px-4 py-4 text-right font-semibold">
                    ${result.price.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-5 text-xs leading-5 text-slate-500">
        Prototype estimates only. The pricing calculation will be refined after
        our SuperCoach data and pricing-model investigation.
      </p>
    </section>
  );
}