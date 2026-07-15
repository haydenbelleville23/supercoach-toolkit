import Link from "next/link";

import { getPlayers } from "@/lib/players";
import { buildCompetitionState } from "@/lib/priceEngine/buildCompetitionState";
import { calculateRoundMagicNumber } from "@/lib/priceEngine/calculateRoundMagicNumber";

function formatMoney(value: number): string {
  return `$${value.toLocaleString()}`;
}

export default function MagicNumberPage() {
  const players = getPlayers();

  const competitionState =
    buildCompetitionState(players, 0);

  const observedSalaryPool = players.reduce(
    (total, player) => total + player.price,
    0,
  );

  const result = calculateRoundMagicNumber(
    competitionState,
    observedSalaryPool,
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xl font-bold">
              SuperCoach Toolkit
            </p>
            <p className="text-sm text-slate-400">
              Magic Number Calculator
            </p>
          </div>

          <Link
            href="/"
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            2026 model
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            Round Magic Number
          </h1>

          <p className="mt-4 text-slate-300">
            Competition-wide estimate based on the current player
            pool, projected scores and the salary-pool constraint.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Calculated MN"
            value={result.magicNumber.toFixed(2)}
          />

          <Stat
            label="Players eligible"
            value={result.eligiblePlayers.toString()}
          />

          <Stat
            label="Locked players"
            value={result.lockedPlayers.toString()}
          />

          <Stat
            label="Target salary pool"
            value={formatMoney(result.targetSalaryPool)}
          />

          <Stat
            label="Calculated salary pool"
            value={formatMoney(result.calculatedSalaryPool)}
          />

          <Stat
            label="Pool difference"
            value={formatMoney(result.salaryPoolDifference)}
          />
        </div>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">
            Calculation totals
          </h2>

          <div className="mt-5 space-y-3 text-sm">
            <Row
              label="Locked salary"
              value={formatMoney(result.lockedSalary)}
            />

            <Row
              label="Eligible previous salary"
              value={formatMoney(
                result.changingPlayerPreviousSalary,
              )}
            />

            <Row
              label="Eligible 3RA total"
              value={result.changingPlayerAverageTotal.toFixed(2)}
            />
          </div>
        </section>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          This is an exploratory 2026 estimate. It depends on the
          completeness of the player list, recent scores and projected
          scores supplied to the competition solver.
        </p>
      </section>
    </main>
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
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold tabular-nums">
        {value}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}