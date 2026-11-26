"use client";

import { useMemo, useState } from "react";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
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

  type Row = { a: (typeof roundsA)[number]; b: (typeof roundsB)[number] | undefined };

  const rows: Row[] = roundsA.map((a, index) => ({ a, b: roundsB[index] }));

  const warnings = (count: number | undefined) =>
    count ? "text-amber-300" : "text-slate-400";

  const pair = (
    id: string,
    label: string,
    value: (round: Row["a"]) => string | number,
    className?: (round: Row["a"] | undefined) => string,
  ): DataTableColumn<Row>[] => [
    {
      id: `${id}A`,
      header: `${label} A`,
      width: 84,
      align: "right",
      cell: (row) => value(row.a),
      cellClassName: className ? (row) => className(row.a) : undefined,
    },
    {
      id: `${id}B`,
      header: `${label} B`,
      width: 84,
      align: "right",
      cell: (row) => (row.b ? value(row.b) : "-"),
      cellClassName: className ? (row) => className(row.b) : undefined,
    },
  ];

  const columns: DataTableColumn<Row>[] = [
    {
      id: "round",
      header: "Round",
      width: 56,
      cell: (row) => `R${row.a.round}`,
      cellClassName: () => "font-semibold",
    },
    ...pair("squadValue", "Squad value", (round) => formatMoney(round.squadValue)),
    ...pair("cash", "Cash", (round) => formatMoney(round.cashAfter)),
    ...pair("tradesLeft", "Trades left", (round) => round.tradesLeftAfter),
    ...pair("warnings", "Warnings", (round) => round.warnings.length, (round) => warnings(round?.warnings.length)),
  ];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
        <h2 className="mr-2 text-lg font-semibold">Compare plans</h2>
        {select(planA?.id ?? "", setAId, "First plan to compare")}
        <span className="text-slate-400">vs</span>
        {select(planB?.id ?? "", setBId, "Second plan to compare")}
      </div>

      <div className="px-2 pb-2 sm:px-3 sm:pb-3">
        <DataTable
          caption="Plan comparison by round"
          rows={rows}
          columns={columns}
          rowKey={(row) => row.a.round}
          empty="No rounds to compare."
        />
      </div>
    </section>
  );
}
