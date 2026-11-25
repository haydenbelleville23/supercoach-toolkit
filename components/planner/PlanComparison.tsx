"use client";

import { useMemo, useState } from "react";

import { formatMoney } from "@/lib/format";
import { evaluatePlan } from "@/lib/planner/evaluatePlan";
import type { MyTeam, TradePlan } from "@/lib/planner/types";

import {
  createPlanProjector,
  PLANNER_COMPLETED_ROUND,
  planRoundCount,
  plannerFixtures,
  teamPlayersById,
} from "./plannerData";

function evaluateFor(team: MyTeam, plan: TradePlan | null) {
  return plan
    ? evaluatePlan({
        team,
        plan,
        playersById: teamPlayersById(team),
        projector: createPlanProjector(plan, team),
        fixtures: plannerFixtures,
        lastRound: PLANNER_COMPLETED_ROUND + planRoundCount(plan),
      })
    : [];
}

/** Side-by-side: squad value, cash, trades left and warnings per round. */
export default function PlanComparison({ team }: { team: MyTeam }) {
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");

  // Fall back to the first two plans if a chosen plan was deleted (or none
  // existed yet when this mounted).
  const planA = team.plans.find((p) => p.id === aId) ?? team.plans[0] ?? null;
  const planB =
    team.plans.find((p) => p.id === bId) ??
    team.plans.find((p) => p.id !== planA?.id) ??
    null;

  const roundsA = useMemo(() => evaluateFor(team, planA), [team, planA]);
  const roundsB = useMemo(() => evaluateFor(team, planB), [team, planB]);

  if (team.plans.length < 2) {
    return null;
  }

  const select = (value: string, onChange: (id: string) => void, label: string) => (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm"
    >
      {team.plans.map((plan) => (
        <option key={plan.id} value={plan.id}>
          {plan.name}
        </option>
      ))}
    </select>
  );

  const cell = "px-2 py-1.5 text-right tabular-nums";

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
        <h2 className="mr-2 text-lg font-semibold">Compare plans</h2>
        {select(planA?.id ?? "", setAId, "First plan to compare")}
        <span className="text-slate-400">vs</span>
        {select(planB?.id ?? "", setBId, "Second plan to compare")}
      </div>

      <div className="overflow-x-auto">
        <table className="w-max min-w-full whitespace-nowrap text-xs">
          <thead className="bg-slate-950 text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Round</th>
              <th className={cell}>Squad value A</th>
              <th className={cell}>Squad value B</th>
              <th className={cell}>Cash A</th>
              <th className={cell}>Cash B</th>
              <th className={cell}>Trades left A</th>
              <th className={cell}>Trades left B</th>
              <th className={cell}>Warnings A</th>
              <th className={cell}>Warnings B</th>
            </tr>
          </thead>

          <tbody>
            {roundsA.map((a, index) => {
              const b = roundsB[index];

              return (
                <tr key={a.round} className="border-t border-slate-800">
                  <td className="px-3 py-1.5 font-semibold">R{a.round}</td>
                  <td className={cell}>{formatMoney(a.squadValue)}</td>
                  <td className={cell}>{b ? formatMoney(b.squadValue) : "-"}</td>
                  <td className={cell}>{formatMoney(a.cashAfter)}</td>
                  <td className={cell}>{b ? formatMoney(b.cashAfter) : "-"}</td>
                  <td className={cell}>{a.tradesLeftAfter}</td>
                  <td className={cell}>{b?.tradesLeftAfter ?? "-"}</td>
                  <td className={`${cell} ${a.warnings.length ? "text-amber-300" : "text-slate-400"}`}>
                    {a.warnings.length}
                  </td>
                  <td className={`${cell} ${b?.warnings.length ? "text-amber-300" : "text-slate-400"}`}>
                    {b?.warnings.length ?? "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
