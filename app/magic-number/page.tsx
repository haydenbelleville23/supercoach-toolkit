import { magicNumberHistory } from "@/data/2026/magic-number-history";
import {
  getMagicNumberDifference,
} from "@/lib/priceEngine/calculateRoundMagicNumber";
import { getPlayers } from "@/lib/players";
import { calculateRoundPlayerPricePool } from "@/lib/priceEngine/calculateRoundPlayerPricePool";
import { solveMagicNumber } from "@/lib/priceEngine/solveMagicNumber";
import { BASE_MAGIC_NUMBER_2026 } from "@/lib/priceEngine/baseMagicNumber";
import { evaluateScaledRound } from "@/lib/priceEngine/evaluateScaledRound";

function formatMagicNumber(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatMoney(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return value.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

function formatDifference(value: number | null): string {
  if (value === null) {
    return "—";
  }

  if (value === 0) {
    return "0";
  }

  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function getDifferenceClassName(
  value: number | null,
): string {
  if (value === null) {
    return "text-slate-500";
  }

  const absoluteDifference = Math.abs(value);

  if (absoluteDifference <= 2) {
    return "text-emerald-400";
  }

  if (absoluteDifference <= 10) {
    return "text-amber-400";
  }

  return "text-red-400";
}

export default function MagicNumberPage() {
  const players = getPlayers();
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
            Internal Tool
          </p>

          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            SuperCoach Magic Number
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Compare the observed SuperCoach magic number with our
              round-by-round estimate and retrospective calculation.
          </p>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-2xl shadow-black/20">
          <div className="border-b border-slate-800 px-4 py-4 sm:px-5">
            <h2 className="font-semibold text-white">
              Season Reconstruction
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              2026 round-by-round pricing reconstruction.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-[90px] px-4 py-3 text-left font-semibold">
                    Round
                  </th>

                  <th className="px-4 py-3 text-right font-semibold">
                    Official MN
                  </th>

                  <th className="px-4 py-3 text-right font-semibold">
                    Total Player Price Pool
                  </th>

                  <th className="px-4 py-3 text-right font-semibold">
                    Players
                  </th>

                  <th className="px-4 py-3 text-right font-semibold">
                    Our Estimate MN
                  </th>

                  <th className="px-4 py-3 text-right font-semibold">
                    Calculated MN
                  </th>

                  <th className="px-4 py-3 text-right font-semibold">
                    Difference
                  </th>

                  <th className="px-4 py-3 text-right font-semibold">
                    Base MN
                  </th>

                  <th className="px-4 py-3 text-right font-semibold">
                    k
                  </th>

                  <th className="px-4 py-3 text-right font-semibold">
                    Effective MN
                  </th>

                  <th className="px-4 py-3 text-right font-semibold">
                    Scaled Avg Error
                  </th>
                </tr>
              </thead>

              <tbody>
                  {magicNumberHistory.map((row) => {
                    const playerPricePool =
                      calculateRoundPlayerPricePool(
                        players,
                        row.round,
                      );

                    const solvedMagicNumber =
                      solveMagicNumber(players, row.round);
                      console.log(
                        `Round ${row.round}`,
                        solvedMagicNumber,
                      );

                    const difference =
                      getMagicNumberDifference(row);

                    const scaledRound = evaluateScaledRound(
                      players,
                      row.round,
                      BASE_MAGIC_NUMBER_2026,
                    );

                    return (
                    <tr
                      key={row.round}
                      className="border-b border-slate-800/80 transition hover:bg-violet-500/[0.04] last:border-b-0"
                    >
                      <td className="px-4 py-3.5 font-semibold text-white">
                        Round {row.round}
                      </td>

                      <td className="px-4 py-3.5 text-right font-medium tabular-nums text-slate-200">
                        {formatMagicNumber(
                          row.magicNumber,
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-300">
                        {playerPricePool.playersIncluded > 0
                          ? formatMoney(
                              playerPricePool.totalPricePool,
                            )
                          : "—"}
                      </td>
                    
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-400">
                        {playerPricePool.playersIncluded > 0
                          ? playerPricePool.playersIncluded.toLocaleString(
                              "en-AU",
                            )
                          : "—"}
                      </td>

                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-300">
                        {formatMagicNumber(
                          row.estimatedMagicNumber,
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-violet-300">
                      {solvedMagicNumber ? (
                        <>
                          {formatMagicNumber(solvedMagicNumber.magicNumber)}

                          <div className="text-xs text-slate-500">
                            {solvedMagicNumber.playersCompared} players
                          </div>

                          <div className="text-xs text-slate-500">
                            Avg error $
                            {Math.round(
                              solvedMagicNumber.averagePriceError,
                            ).toLocaleString("en-AU")}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>

                      <td
                        className={`px-4 py-3.5 text-right tabular-nums ${getDifferenceClassName(
                          difference,
                        )}`}
                      >
                        {formatDifference(difference)}
                      </td>

                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-300">
                        {scaledRound
                          ? formatMagicNumber(
                              scaledRound.baseMagicNumber,
                            )
                          : "—"}
                      </td>

                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-300">
                        {scaledRound
                          ? scaledRound.k.toFixed(5)
                          : "—"}
                      </td>

                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-300">
                        {scaledRound
                          ? formatMagicNumber(
                              scaledRound.effectiveMagicNumber,
                            )
                          : "—"}
                      </td>

                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-emerald-300">
                        {scaledRound ? (
                          <>
                            $
                            {Math.round(
                              scaledRound.averagePriceError,
                            ).toLocaleString("en-AU")}

                            <div className="text-xs font-normal text-slate-500">
                              {scaledRound.playersCompared} players
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-4 text-xs leading-5 text-slate-600">
          This page is intended for internal pricing research and
          is not linked from the public Fantasy King navigation.
        </p>
      </div>
    </main>
  );
}