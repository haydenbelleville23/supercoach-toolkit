"use client";

import Link from "next/link";
import { useMemo } from "react";

import { evaluatePlan } from "@/lib/planner/evaluatePlan";
import { createPlan } from "@/lib/planner/teamFile";
import { MAX_PLANS, type MyTeam, type PlanRound, type TradePlan } from "@/lib/planner/types";
import { saveMyTeam, useMyTeam } from "@/lib/planner/useMyTeam";

import type { Player } from "@/types/player";

import PlanComparison from "./PlanComparison";
import { PlayerOptions } from "./PlayerPicker";
import PriceGrid from "./PriceGrid";
import RoundCard from "./RoundCard";
import {
  createPlanProjector,
  PLANNER_COMPLETED_ROUND,
  PLANNER_LAST_ROUND,
  plannerFixtures,
  plannerPlayers,
  plannerPlayersById,
  playerLabel,
} from "./plannerData";

const PLAYER_LIST_ID = "planner-all-players";
const EMPTY_ROUND: PlanRound = { trades: [], boost: false };

const playersByLabel = new Map(plannerPlayers.map((p) => [playerLabel(p), p]));

export default function TradePlannerTool() {
  const team = useMyTeam();

  if (!team || team.players.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
        Build your squad first on{" "}
        <Link href="/my-team" className="font-semibold text-violet-300 underline">
          My Team
        </Link>
        , then plan trades here.
      </section>
    );
  }

  if (PLANNER_COMPLETED_ROUND >= PLANNER_LAST_ROUND) {
    return (
      <section role="status" className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
        No rounds left to plan: the data is complete to Round {PLANNER_COMPLETED_ROUND}. Plans
        start from the round after the latest completed one (set DEBUG_AS_OF_ROUND to plan from
        an earlier round).
      </section>
    );
  }

  return <Planner team={team} />;
}

function Planner({ team }: { team: MyTeam }) {
  const activePlan =
    team.plans.find((p) => p.id === team.activePlanId) ?? team.plans[0] ?? null;

  const projector = useMemo(() => createPlanProjector(activePlan), [activePlan]);

  const rounds = useMemo(
    () =>
      evaluatePlan({
        team,
        plan: activePlan,
        playersById: plannerPlayersById,
        projector,
        fixtures: plannerFixtures,
      }),
    [team, activePlan, projector],
  );

  const savePlans = (plans: TradePlan[], activePlanId = team.activePlanId) =>
    saveMyTeam({ ...team, plans, activePlanId });

  const updateActive = (change: (plan: TradePlan) => TradePlan) => {
    if (activePlan) {
      savePlans(team.plans.map((p) => (p.id === activePlan.id ? change(p) : p)), activePlan.id);
    }
  };

  const addPlan = (base: TradePlan | null) => {
    if (team.plans.length >= MAX_PLANS) {
      return;
    }

    const plan: TradePlan = base
      ? {
          ...createPlan(`${base.name} (copy)`),
          rounds: structuredClone(base.rounds),
          scoreOverrides: structuredClone(base.scoreOverrides),
        }
      : createPlan(`Plan ${team.plans.length + 1}`);

    savePlans([...team.plans, plan], plan.id);
  };

  // Everyone who appears in the plan: starting squad plus traded-in players.
  const gridPlayers: Player[] = useMemo(() => {
    const ids = new Set<number>(team.players.map((p) => p.id));
    rounds.forEach((r) => r.trades.forEach((t) => t.inId !== null && ids.add(t.inId)));

    return [...ids]
      .map((id) => plannerPlayersById.get(id))
      .filter((p): p is Player => !!p)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [team, rounds]);

  const button =
    "rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-40";

  return (
    <div className="mt-8 space-y-5">
      <PlayerOptions id={PLAYER_LIST_ID} players={plannerPlayers} />

      {team.asOfRound !== PLANNER_COMPLETED_ROUND && (
        <p role="status" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          Your team was saved as of Round {team.asOfRound}; plans start from Round{" "}
          {PLANNER_COMPLETED_ROUND + 1}. Check cash, trades and boosts on My Team.
        </p>
      )}

      {/* Plans */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {team.plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => savePlans(team.plans, plan.id)}
              aria-pressed={plan.id === activePlan?.id}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                plan.id === activePlan?.id
                  ? "bg-violet-500 text-white"
                  : "border border-slate-700 text-slate-300"
              }`}
            >
              {plan.name}
            </button>
          ))}

          <button type="button" className={button} disabled={team.plans.length >= MAX_PLANS} onClick={() => addPlan(null)}>
            + New plan
          </button>
        </div>

        {activePlan && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={button} disabled={team.plans.length >= MAX_PLANS} onClick={() => addPlan(activePlan)}>
              Duplicate
            </button>
            <button
              type="button"
              className={button}
              onClick={() => {
                const name = window.prompt("Plan name", activePlan.name)?.trim();
                if (name) {
                  updateActive((p) => ({ ...p, name }));
                }
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className={`${button} text-red-300`}
              onClick={() => {
                if (window.confirm(`Delete "${activePlan.name}"?`)) {
                  const remaining = team.plans.filter((p) => p.id !== activePlan.id);
                  savePlans(remaining, remaining[0]?.id ?? null);
                }
              }}
            >
              Delete
            </button>
          </div>
        )}

        <p className="mt-2 text-xs text-slate-400">
          Up to {MAX_PLANS} plans, saved in this browser with your team.
        </p>
      </section>

      {!activePlan ? (
        <p className="text-sm text-slate-300">Create a plan to start adding trades.</p>
      ) : (
        <>
          {rounds.map((summary, index) => (
            <RoundCard
              key={summary.round}
              summary={summary}
              planRound={activePlan.rounds[summary.round] ?? EMPTY_ROUND}
              squadBefore={index === 0 ? team.players.map((p) => p.id) : rounds[index - 1].squad}
              playersById={plannerPlayersById}
              playersByLabel={playersByLabel}
              listId={PLAYER_LIST_ID}
              onChange={(next) =>
                updateActive((plan) => ({
                  ...plan,
                  rounds: { ...plan.rounds, [summary.round]: next },
                }))
              }
            />
          ))}

          <PriceGrid
            players={gridPlayers}
            projector={projector}
            overrides={activePlan.scoreOverrides}
            onOverride={(playerId, round, score) =>
              updateActive((plan) => {
                const forPlayer = { ...(plan.scoreOverrides[playerId] ?? {}) };

                if (score === null) {
                  delete forPlayer[round];
                } else {
                  forPlayer[round] = score;
                }

                return { ...plan, scoreOverrides: { ...plan.scoreOverrides, [playerId]: forPlayer } };
              })
            }
          />
        </>
      )}

      <PlanComparison team={team} />
    </div>
  );
}
