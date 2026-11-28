"use client";

import Link from "next/link";
import { useMemo } from "react";

import InfoPopover from "@/components/ui/InfoPopover";
import OverflowMenu from "@/components/ui/OverflowMenu";
import { availabilitySnapshot, likelyPlaying } from "@/lib/availability";
import { useMatchupSetting } from "@/lib/fixtureDifficulty/useMatchupSetting";
import { evaluatePlan } from "@/lib/planner/evaluatePlan";
import { addPlaceholder, isPlaceholderId } from "@/lib/planner/placeholders";
import { createPlan, duplicatePlan } from "@/lib/planner/teamFile";
import { countPriceOverrides, resetPriceOverrides, withoutPriceOverrides } from "@/lib/planner/tradePrices";
import { MAX_PLANS, type MyTeam, type PlanRound, type TradePlan } from "@/lib/planner/types";
import { saveMyTeam, useMyTeam } from "@/lib/planner/useMyTeam";

import type { Player } from "@/types/player";

import PlanComparison from "./PlanComparison";
import PriceGrid from "./PriceGrid";
import RoundCard from "./RoundCard";
import {
  createPlanProjector,
  PLANNER_COMPLETED_ROUND,
  PLANNER_FIRST_ROUND,
  PLANNER_MAX_ROUNDS,
  planRoundCount,
  plannerFixtures,
  teamPlayersById,
} from "./plannerData";

const EMPTY_ROUND: PlanRound = { trades: [], boost: false };
const FIRST_ROUND = PLANNER_FIRST_ROUND;
const MAX_ROUNDS = PLANNER_MAX_ROUNDS;

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

  if (MAX_ROUNDS <= 0) {
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
  const view = team.plannerView ?? "plan";

  const playersById = useMemo(() => teamPlayersById(team), [team]);
  const pickerPlayers = useMemo(() => [...playersById.values()], [playersById]);

  // "Matchup adjustment" (on by default, shared with the Projector).
  const [matchupOn, setMatchupOn] = useMatchupSetting();

  const projector = useMemo(
    () => createPlanProjector(activePlan, team, matchupOn),
    [activePlan, team, matchupOn],
  );

  const roundCount = planRoundCount(activePlan);
  const priceOverrideCount = activePlan ? countPriceOverrides(activePlan) : 0;
  const lastShown = FIRST_ROUND + roundCount - 1;

  // On by default: long-term injured and suspended don't count as playing.
  const countUnavailableAsOut = team.countUnavailableAsOut !== false;

  const rounds = useMemo(
    () =>
      evaluatePlan({
        team,
        plan: activePlan,
        playersById,
        projector,
        fixtures: plannerFixtures,
        lastRound: lastShown,
        isOut: countUnavailableAsOut
          ? (playerId, round) => !likelyPlaying(playersById.get(playerId) ?? { id: playerId }, round)
          : undefined,
      }),
    [team, activePlan, playersById, projector, lastShown, countUnavailableAsOut],
  );

  const save = (next: MyTeam) => saveMyTeam(next);

  const withPlan = (base: MyTeam, change: (plan: TradePlan) => TradePlan): MyTeam =>
    activePlan
      ? {
          ...base,
          plans: base.plans.map((p) => (p.id === activePlan.id ? change(p) : p)),
          activePlanId: activePlan.id,
        }
      : base;

  const updatePlan = (change: (plan: TradePlan) => TradePlan) => save(withPlan(team, change));

  const setRound = (round: number, next: PlanRound) =>
    updatePlan((plan) => ({ ...plan, rounds: { ...plan.rounds, [round]: next } }));

  const toggleIn = (list: number[] | undefined, round: number) =>
    (list ?? []).includes(round)
      ? (list ?? []).filter((r) => r !== round)
      : [...(list ?? []), round];

  const addPlan = (base: TradePlan | null) => {
    if (team.plans.length >= MAX_PLANS) {
      return;
    }

    const plan: TradePlan = base
      ? duplicatePlan(base, `${base.name} (copy)`)
      : createPlan(`Plan ${team.plans.length + 1}`);

    save({ ...team, plans: [...team.plans, plan], activePlanId: plan.id });
  };

  const setOverride = (playerId: number, round: number, score: number | null) =>
    updatePlan((plan) => {
      const forPlayer = { ...(plan.scoreOverrides[playerId] ?? {}) };

      if (score === null) {
        delete forPlayer[round];
      } else {
        forPlayer[round] = score;
      }

      return { ...plan, scoreOverrides: { ...plan.scoreOverrides, [playerId]: forPlayer } };
    });

  // Scores view: everyone in the squad at any shown round or in a trade.
  const scorePlayers: Player[] = useMemo(() => {
    const ids = new Set<number>(team.players.map((p) => p.id));
    rounds.forEach((r) => {
      r.squad.forEach((id) => ids.add(id));
      r.trades.forEach((t) => {
        if (t.inId !== null) ids.add(t.inId);
        if (t.outId !== null) ids.add(t.outId);
      });
    });

    return [...ids]
      .filter((id) => !isPlaceholderId(id))
      .map((id) => playersById.get(id))
      .filter((p): p is Player => !!p)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [team, rounds, playersById]);

  const plansFull = team.plans.length >= MAX_PLANS;
  const plansFullReason = `${MAX_PLANS} plans is the most`;

  const button =
    "rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-40";

  const lastRoundHasData = (() => {
    const last = activePlan?.rounds[lastShown];
    return !!last && (last.boost || last.trades.length > 0);
  })();

  return (
    <div className="mt-8 space-y-5">
      {team.asOfRound !== PLANNER_COMPLETED_ROUND && (
        <p role="status" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          Your team was saved as of Round {team.asOfRound}; plans start from Round {FIRST_ROUND}.
          Check cash, trades and boosts on My Team.
        </p>
      )}

      {/* Plans */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {team.plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => save({ ...team, activePlanId: plan.id })}
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

          <button type="button" className={button} disabled={plansFull} onClick={() => addPlan(null)}>
            + New plan
          </button>
          {plansFull && <span className="text-xs text-slate-400">{plansFullReason}</span>}

          <InfoPopover label="About plans">Up to {MAX_PLANS} plans, saved in this browser with your team.</InfoPopover>

          {activePlan && (
            <div className="ml-auto">
              <OverflowMenu
                label={`Actions for ${activePlan.name}`}
                items={[
                  {
                    label: "Duplicate",
                    disabledReason: plansFull ? plansFullReason : null,
                    onSelect: () => addPlan(activePlan),
                  },
                  {
                    label: "Rename",
                    onSelect: () => {
                      const name = window.prompt("Plan name", activePlan.name)?.trim();
                      if (name) {
                        updatePlan((p) => ({ ...p, name }));
                      }
                    },
                  },
                  {
                    label: `Reset price overrides${priceOverrideCount > 0 ? ` (${priceOverrideCount})` : ""}`,
                    disabledReason: priceOverrideCount === 0 ? "No typed trade prices in this plan" : null,
                    onSelect: () => {
                      if (window.confirm(`Reset all ${priceOverrideCount} typed trade prices in "${activePlan.name}"?`)) {
                        updatePlan(resetPriceOverrides);
                      }
                    },
                  },
                  {
                    label: "Delete",
                    danger: true,
                    onSelect: () => {
                      if (window.confirm(`Delete "${activePlan.name}"?`)) {
                        const remaining = team.plans.filter((p) => p.id !== activePlan.id);
                        save({ ...team, plans: remaining, activePlanId: remaining[0]?.id ?? null });
                      }
                    },
                  },
                ]}
              />
            </div>
          )}
        </div>
      </section>

      {!activePlan ? (
        <p className="text-sm text-slate-300">Create a plan to start adding trades.</p>
      ) : (
        <>
          {/* Plan / Scores toggle */}
          <div role="tablist" aria-label="Planner view" className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
            {(["plan", "scores"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={view === option}
                onClick={() => save({ ...team, plannerView: option })}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  view === option ? "bg-violet-500 text-white" : "text-slate-300"
                }`}
              >
                {option === "plan" ? "Plan" : "Scores"}
              </button>
            ))}
          </div>

          <div className="flex items-center">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={countUnavailableAsOut}
              onChange={(e) => save({ ...team, countUnavailableAsOut: e.target.checked })}
              className="h-5 w-5 shrink-0 accent-violet-500"
            />
            <span>Injured and suspended players don&apos;t count as playing</span>
          </label>
          <InfoPopover label="About the injured setting">
            {availabilitySnapshot
              ? "Long-term injured and suspended players aren't counted in the playing counts and bye warnings. Prices and projections are unaffected."
              : "No injury list loaded yet, so everyone counts as playing."}
          </InfoPopover>
          </div>

          {view === "plan" ? (
            <>
              {rounds.map((summary, index) => (
                <RoundCard
                  key={summary.round}
                  summary={summary}
                  planRound={activePlan.rounds[summary.round] ?? EMPTY_ROUND}
                  squadBefore={index === 0 ? team.players.map((p) => p.id) : rounds[index - 1].squad}
                  playersById={playersById}
                  allPlayers={pickerPlayers}
                  priceAt={(playerId, round) => projector.getPriceBefore(playerId, round)}
                  placeholders={team.placeholders ?? []}
                  collapsed={(activePlan.collapsedRounds ?? []).includes(summary.round)}
                  fieldOpen={(activePlan.openFields ?? []).includes(summary.round)}
                  onChange={(next) => setRound(summary.round, next)}
                  onToggleCollapsed={() =>
                    updatePlan((plan) => ({
                      ...plan,
                      collapsedRounds: toggleIn(plan.collapsedRounds, summary.round),
                    }))
                  }
                  onToggleField={() =>
                    updatePlan((plan) => ({
                      ...plan,
                      openFields: toggleIn(plan.openFields, summary.round),
                    }))
                  }
                  onNewRookie={(tradeIndex, position) => {
                    const created = addPlaceholder(team, position);
                    const current = activePlan.rounds[summary.round] ?? EMPTY_ROUND;

                    save(
                      withPlan(created.team, (plan) => ({
                        ...plan,
                        rounds: {
                          ...plan.rounds,
                          [summary.round]: {
                            ...current,
                            // A new player in: the row's price overrides go.
                            trades: current.trades.map((t, i) =>
                              i === tradeIndex ? withoutPriceOverrides({ ...t, inId: created.id }) : t,
                            ),
                          },
                        },
                      })),
                    );
                  }}
                  onPlaceholderTeam={(placeholderId, teamCode) =>
                    save({
                      ...team,
                      placeholders: (team.placeholders ?? []).map((p) =>
                        p.id === placeholderId ? { ...p, team: teamCode } : p,
                      ),
                    })
                  }
                />
              ))}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={button}
                  disabled={roundCount >= MAX_ROUNDS}
                  title={roundCount >= MAX_ROUNDS ? "No more rounds this season" : undefined}
                  onClick={() => updatePlan((plan) => ({ ...plan, roundCount: roundCount + 1 }))}
                >
                  + Add round {roundCount < MAX_ROUNDS ? lastShown + 1 : ""}
                </button>

                <button
                  type="button"
                  className={button}
                  disabled={roundCount <= 1}
                  onClick={() => {
                    if (
                      lastRoundHasData &&
                      !window.confirm(`Remove Round ${lastShown} and its trades?`)
                    ) {
                      return;
                    }

                    updatePlan((plan) => {
                      const remaining = { ...plan.rounds };
                      delete remaining[lastShown];
                      return { ...plan, rounds: remaining, roundCount: roundCount - 1 };
                    });
                  }}
                >
                  Remove Round {lastShown}
                </button>
              </div>
            </>
          ) : (
            <PriceGrid
              players={scorePlayers}
              projector={projector}
              lastRound={lastShown}
              overrides={activePlan.scoreOverrides}
              onOverride={setOverride}
              onReset={() => updatePlan((plan) => ({ ...plan, scoreOverrides: {} }))}
              matchupOn={matchupOn}
              onMatchupChange={setMatchupOn}
            />
          )}
        </>
      )}

      <PlanComparison team={team} />
    </div>
  );
}
