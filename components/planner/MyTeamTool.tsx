"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatMoney } from "@/lib/format";
import { toMatchPlayer } from "@/lib/planner/evaluatePlan";
import {
  checkSquadPositions,
  type Slot,
  type SlotArea,
  type SlotPosition,
} from "@/lib/planner/positionMatching";
import { createEmptyTeam } from "@/lib/planner/teamFile";
import type { MyTeam, SquadEntry } from "@/lib/planner/types";
import { saveMyTeam, useMyTeam } from "@/lib/planner/useMyTeam";
import {
  getEligiblePositions,
  POSITIONS,
  SQUAD_RULES,
} from "@/lib/rules/squadRules";

import type { Player } from "@/types/player";

import NumberField from "./NumberField";
import TeamFileControls from "./TeamFileControls";
import {
  PLANNER_COMPLETED_ROUND,
  PLANNER_SEASON,
  plannerPlayers,
  plannerPlayersById,
} from "./plannerData";

const SLOT_ORDER: SlotPosition[] = ["DEF", "MID", "RUC", "FWD", "FLEX"];

function pinValue(pin: SquadEntry["pin"]): string {
  return pin ? `${pin.area}:${pin.position}` : "auto";
}

function parsePin(value: string): SquadEntry["pin"] {
  if (value === "auto") {
    return null;
  }

  const [area, position] = value.split(":");
  return { area: area as SlotArea, position: position as SlotPosition };
}

export default function MyTeamTool() {
  const team = useMyTeam();
  const [query, setQuery] = useState("");

  const update = (changes: Partial<MyTeam>) => {
    if (team) {
      saveMyTeam({ ...team, ...changes });
    }
  };

  const squadPlayers = useMemo(
    () =>
      (team?.players ?? [])
        .map((entry) => ({ entry, player: plannerPlayersById.get(entry.id) }))
        .filter((row): row is { entry: SquadEntry; player: Player } => !!row.player),
    [team],
  );

  const missing = (team?.players ?? []).filter((e) => !plannerPlayersById.has(e.id));

  const match = useMemo(
    () =>
      checkSquadPositions(
        squadPlayers.map(({ entry, player }) => toMatchPlayer(player, entry.pin)),
      ),
    [squadPlayers],
  );

  const results = useMemo(() => {
    const text = query.trim().toLowerCase();

    if (text.length < 2) {
      return [];
    }

    return plannerPlayers
      .filter(
        (p) =>
          p.name.toLowerCase().includes(text) ||
          p.team.toLowerCase() === text ||
          p.teamName.toLowerCase().includes(text),
      )
      .slice(0, 20);
  }, [query]);

  if (!team) {
    return (
      <section className="mt-8 space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-slate-300">
          No team saved in this browser yet. Start one, or import a team file.
        </p>

        <button
          type="button"
          onClick={() => saveMyTeam(createEmptyTeam(PLANNER_SEASON, PLANNER_COMPLETED_ROUND))}
          className="rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400"
        >
          Start a new team
        </button>

        <TeamFileControls team={null} />
      </section>
    );
  }

  const inSquad = new Set(team.players.map((p) => p.id));
  const squadValue = squadPlayers.reduce((t, r) => t + r.player.price, 0);
  const full = team.players.length >= SQUAD_RULES.squadSize;

  const grouped = new Map<string, { player: Player; entry: SquadEntry; slot: Slot | undefined }[]>();

  for (const row of squadPlayers) {
    const slot = match.assignment.get(row.player.id);
    const key = slot ? `${slot.area}:${slot.position}` : "unplaced";
    grouped.set(key, [...(grouped.get(key) ?? []), { ...row, slot }]);
  }


  return (
    <div className="mt-8 space-y-6">
      {team.asOfRound !== PLANNER_COMPLETED_ROUND && (
        <section role="status" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          This team was saved as of Round {team.asOfRound}; the site is now at Round{" "}
          {PLANNER_COMPLETED_ROUND}. Prices use Round {PLANNER_COMPLETED_ROUND}. Update the
          cash, trades and boosts below, then{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => update({ asOfRound: PLANNER_COMPLETED_ROUND })}
          >
            mark it as Round {PLANNER_COMPLETED_ROUND}
          </button>
          .
        </section>
      )}

      {missing.length > 0 && (
        <section role="status" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          {missing.length} saved player{missing.length === 1 ? "" : "s"} can&apos;t be found in the
          current data (for example, added after Round {PLANNER_COMPLETED_ROUND}).{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() =>
              update({ players: team.players.filter((e) => plannerPlayersById.has(e.id)) })
            }
          >
            Remove them
          </button>
        </section>
      )}

      <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:grid-cols-3">
        <NumberField
          label="Cash in bank ($)"
          money
          value={team.cashInBank}
          onChange={(cashInBank) => update({ cashInBank })}
        />

        <NumberField
          label="Trades remaining (season)"
          value={team.tradesRemaining}
          onChange={(tradesRemaining) => update({ tradesRemaining })}
        />

        <NumberField
          label="Boosts remaining"
          value={team.boostsRemaining}
          onChange={(boostsRemaining) => update({ boostsRemaining })}
        />
      </section>

      <section
        role="status"
        className={`rounded-2xl border p-4 text-sm ${
          match.valid
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
            : "border-amber-500/40 bg-amber-500/10 text-amber-100"
        }`}
      >
        <p className="font-semibold">
          {team.players.length}/{SQUAD_RULES.squadSize} players ·{" "}
          {match.valid ? "Valid squad" : "Not a valid squad yet"}
        </p>

        {match.problems.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {match.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}

        <p className="mt-2 text-xs opacity-80">
          Squad value {formatMoney(squadValue)} · Cash {formatMoney(team.cashInBank)} · Total{" "}
          {formatMoney(squadValue + team.cashInBank)} (Round {PLANNER_COMPLETED_ROUND} prices)
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Add players
          <input
            type="search"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-violet-500"
            placeholder="Search by name or team (e.g. COL)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        {results.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-800">
            {results.map((player) => (
              <li key={player.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{player.name}</p>
                  <p className="text-xs text-slate-400">
                    {player.team} · {player.positions.join("/")} · {formatMoney(player.price)}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={inSquad.has(player.id) || full}
                  onClick={() =>
                    update({ players: [...team.players, { id: player.id, pin: null }] })
                  }
                  className="shrink-0 rounded-lg border border-violet-500/50 px-3 py-1.5 text-xs font-semibold text-violet-200 disabled:opacity-40"
                >
                  {inSquad.has(player.id) ? "In squad" : full ? "Squad full" : "Add"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        {(["field", "bench"] as const).map((area) => (
          <div key={area} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-semibold">
              {area === "field" ? "On field (23)" : "Bench (8)"}
            </h2>

            {SLOT_ORDER.filter((pos) => !(area === "bench" && pos === "FLEX")).map((position) => {
              const rows = grouped.get(`${area}:${position}`) ?? [];
              const capacity =
                position === "FLEX"
                  ? SQUAD_RULES.onFieldFlex
                  : area === "field"
                    ? SQUAD_RULES.onField[position]
                    : SQUAD_RULES.bench[position];

              return (
                <div key={position} className="mt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {position} {rows.length}/{capacity}
                  </h3>

                  <ul className="mt-1 divide-y divide-slate-800">
                    {rows.map(({ player, entry }) => (
                      <SquadRow
                        key={player.id}
                        player={player}
                        entry={entry}
                        onPin={(pin) =>
                          update({
                            players: team.players.map((e) => (e.id === player.id ? { ...e, pin } : e)),
                          })
                        }
                        onRemove={() =>
                          update({ players: team.players.filter((e) => e.id !== player.id) })
                        }
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}

        {(grouped.get("unplaced") ?? []).length > 0 && (
          <div className="rounded-2xl border border-amber-500/40 bg-slate-900 p-5">
            <h2 className="text-lg font-semibold text-amber-200">Can&apos;t be placed</h2>
            <ul className="mt-1 divide-y divide-slate-800">
              {(grouped.get("unplaced") ?? []).map(({ player, entry }) => (
                <SquadRow
                  key={player.id}
                  player={player}
                  entry={entry}
                  onPin={(pin) =>
                    update({
                      players: team.players.map((e) => (e.id === player.id ? { ...e, pin } : e)),
                    })
                  }
                  onRemove={() =>
                    update({ players: team.players.filter((e) => e.id !== player.id) })
                  }
                />
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <TeamFileControls team={team} />

        <Link
          href="/trade-planner"
          className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400"
        >
          Plan trades →
        </Link>
      </section>
    </div>
  );
}

function SquadRow({
  player,
  entry,
  onPin,
  onRemove,
}: {
  player: Player;
  entry: SquadEntry;
  onPin: (pin: SquadEntry["pin"]) => void;
  onRemove: () => void;
}) {
  const eligible = getEligiblePositions(player.positions);

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{player.name}</p>
        <p className="text-xs text-slate-400">
          {player.team} · {player.positions.join("/")} · {formatMoney(player.price)}
        </p>
      </div>

      <select
        aria-label={`Placement for ${player.name}`}
        value={pinValue(entry.pin)}
        onChange={(e) => onPin(parsePin(e.target.value))}
        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs"
      >
        <option value="auto">Auto</option>
        {POSITIONS.filter((p) => eligible.includes(p)).map((p) => (
          <option key={`field-${p}`} value={`field:${p}`}>
            Field {p}
          </option>
        ))}
        <option value="field:FLEX">Field FLEX</option>
        {POSITIONS.filter((p) => eligible.includes(p)).map((p) => (
          <option key={`bench-${p}`} value={`bench:${p}`}>
            Bench {p}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${player.name}`}
        className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white"
      >
        Remove
      </button>
    </li>
  );
}
