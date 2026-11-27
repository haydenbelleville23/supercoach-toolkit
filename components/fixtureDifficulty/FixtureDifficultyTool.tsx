"use client";

import { useState } from "react";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import TeamChip from "@/components/ui/TeamChip";
import { difficultyBand, formatSigned, teamNetBand, type DifficultyBand } from "@/lib/fixtureDifficulty/colour";
import { LOW_SAMPLE_N, POSITION_GROUPS, type PositionGroup } from "@/lib/fixtureDifficulty/config";
import type { FixtureCell, FixtureRow } from "@/lib/fixtureDifficulty/fixtureDifficulty";
import type { FixtureDifficultyData } from "@/lib/fixtureDifficulty/pageData";
import type { TeamDifficulty } from "@/lib/fixtureDifficulty/teamDifficulty";
import { TEAMS } from "@/lib/teams";

type View = "fixtures" | "positions" | "teams";

const VIEWS: { id: View; label: string }[] = [
  { id: "fixtures", label: "Fixtures" },
  { id: "positions", label: "Positions" },
  { id: "teams", label: "Teams" },
];

const BAND_WORD: Record<DifficultyBand, string> = { easy: "easier", neutral: "neutral", hard: "harder" };

/** A signed value in a tinted box; the number is always shown. */
export function DifficultyValue({ value, band, label }: { value: number | null; band?: DifficultyBand; label?: string }) {
  const b = band ?? difficultyBand(value);
  return (
    <span className="fd-cell" data-band={b} title={value === null ? "No data" : `${label ?? "Difficulty"}: ${BAND_WORD[b]}`}>
      {formatSigned(value)}
    </span>
  );
}

function Tabs<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          onClick={() => onChange(option.id)}
          className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition sm:px-4 ${
            value === option.id ? "bg-violet-500 text-white" : "text-slate-300 hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TeamName({ team }: { team: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <TeamChip team={team} size={18} />
      <span className="truncate font-semibold text-white">
        <span className="sm:hidden">{team}</span>
        <span className="hidden sm:inline">{TEAMS[team]?.name ?? team}</span>
      </span>
    </span>
  );
}

export function Legend() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
      {/* Each swatch stays with its word when the line wraps. */}
      <span className="inline-flex items-center gap-1.5">
        <span className="fd-cell" data-band="easy">+4.0</span> Easier
      </span>
      <span aria-hidden="true">/</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="fd-cell" data-band="neutral">0.0</span> Neutral
      </span>
      <span aria-hidden="true">/</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="fd-cell" data-band="hard">−4.0</span> Harder opponent
      </span>
    </p>
  );
}

function RoundCell({ cell, completed }: { cell: FixtureCell; completed: boolean }) {
  if (cell.bye) {
    return <span className="text-xs font-semibold text-slate-500">BYE</span>;
  }
  return (
    <span className={`flex flex-col items-end gap-0.5 ${completed ? "opacity-60" : ""}`}>
      <span className="text-[11px] font-semibold text-slate-300">
        {cell.homeAway === "A" ? "@" : ""}
        {cell.opponent}
      </span>
      <DifficultyValue value={cell.value} label={`${cell.homeAway === "A" ? "@" : "v "}${cell.opponent}`} />
    </span>
  );
}

function FixturesView({ data }: { data: FixtureDifficultyData }) {
  const [position, setPosition] = useState<PositionGroup>("MID");
  const [showEarlier, setShowEarlier] = useState(false);

  // Next round to the end; the whole season (completed) when none remain.
  const firstShown = !data.hasFutureRounds || showEarlier ? 0 : data.asOfRound + 1;
  const rounds = Array.from({ length: data.lastRound - firstShown + 1 }, (_, i) => firstShown + i);

  const columns: DataTableColumn<FixtureRow>[] = [
    {
      id: "team",
      header: "Team",
      width: { base: 76, sm: 176 },
      sortValue: (row) => TEAMS[row.team]?.name ?? row.team,
      firstSortDirection: "asc",
      cell: (row) => <TeamName team={row.team} />,
    },
    {
      id: "rest",
      header: "Rest",
      label: "Mean over the rounds still to play",
      width: 80,
      align: "right",
      sortValue: (row) => row.rest,
      cell: (row) => <DifficultyValue value={row.rest} label="Rest of season" />,
    },
    {
      id: "next5",
      header: "Next 5",
      label: "Mean over the next five games (byes skipped)",
      width: 86,
      align: "right",
      sortValue: (row) => row.next5,
      cell: (row) => <DifficultyValue value={row.next5} label="Next 5 games" />,
    },
    ...rounds.map(
      (round): DataTableColumn<FixtureRow> => ({
        id: `r${round}`,
        header: round <= data.asOfRound ? `R${round} ✓` : `R${round}`,
        label: round <= data.asOfRound ? `Round ${round} (completed)` : `Round ${round}`,
        width: 74,
        align: "right",
        cell: (row) => <RoundCell cell={row.cells.find((c) => c.round === round)!} completed={round <= data.asOfRound} />,
      }),
    ),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          label="Position"
          options={POSITION_GROUPS.map((p) => ({ id: p, label: p }))}
          value={position}
          onChange={setPosition}
        />
        {data.hasFutureRounds ? (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={showEarlier}
              onChange={(e) => setShowEarlier(e.target.checked)}
              className="h-4 w-4 accent-violet-500"
            />
            Show earlier rounds
          </label>
        ) : (
          <p className="text-sm text-slate-400">The season is complete: every round is shown (✓ = completed).</p>
        )}
      </div>

      <DataTable
        key={position}
        caption={`${position} fixture difficulty by team and round`}
        rows={data.fixtures[position]}
        columns={columns}
        rowKey={(row) => row.team}
        defaultSort={{ columnId: "next5", direction: "desc" }}
        compact
      />
    </div>
  );
}

function PositionsView({ data }: { data: FixtureDifficultyData }) {
  type Row = FixtureDifficultyData["positions"][number];

  const columns: DataTableColumn<Row>[] = [
    {
      id: "team",
      header: "Opponent",
      width: { base: 76, sm: 176 },
      sortValue: (row) => TEAMS[row.team]?.name ?? row.team,
      firstSortDirection: "asc",
      cell: (row) => <TeamName team={row.team} />,
    },
    ...POSITION_GROUPS.map(
      (position): DataTableColumn<Row> => ({
        id: position,
        header: position,
        label: `${position} difficulty`,
        width: { base: 70, sm: 110 },
        align: "right",
        sortValue: (row) => row.cells[position]?.value ?? null,
        cell: (row) => {
          const cell = row.cells[position];
          if (!cell) return <span className="text-slate-500">-</span>;
          const low = cell.n < LOW_SAMPLE_N;
          return (
            <span className="flex flex-col items-end gap-0.5">
              <DifficultyValue value={cell.value} label={`${position} against ${row.team}`} />
              <span className={`text-[10px] tabular-nums ${low ? "font-semibold text-amber-300" : "text-slate-500"}`}>
                n={cell.n}
                {low ? " · low" : ""}
              </span>
            </span>
          );
        },
      }),
    ),
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        How far above or below their own average good players score against each team.
        &ldquo;low&rdquo; marks fewer than {LOW_SAMPLE_N} player-games.
      </p>
      <DataTable
        caption="Position difficulty by opponent"
        rows={data.positions}
        columns={columns}
        rowKey={(row) => row.team}
        defaultSort={{ columnId: "MID", direction: "desc" }}
        compact
        fitToViewport={false}
      />
    </div>
  );
}

function TeamsView({ data }: { data: FixtureDifficultyData }) {
  const whole = (n: number) => Math.round(n).toLocaleString("en-AU");

  const columns: DataTableColumn<TeamDifficulty>[] = [
    {
      id: "team",
      header: "Team",
      width: { base: 76, sm: 176 },
      sortValue: (row) => TEAMS[row.team]?.name ?? row.team,
      firstSortDirection: "asc",
      cell: (row) => <TeamName team={row.team} />,
    },
    { id: "for", header: "For", label: "Points per game", width: 64, align: "right", sortValue: (r) => r.pointsFor, cell: (r) => whole(r.pointsFor) },
    { id: "against", header: "Against", label: "Points conceded per game", width: 70, align: "right", sortValue: (r) => r.pointsAgainst, cell: (r) => whole(r.pointsAgainst) },
    {
      id: "net",
      header: "Net",
      label: "Against minus For",
      width: 70,
      align: "right",
      sortValue: (r) => r.net,
      cell: (r) => <DifficultyValue value={r.net} band={teamNetBand(r.net)} label="Net per game" />,
    },
    { id: "games", header: "Games", width: 58, align: "right", sortValue: (r) => r.games, cell: (r) => r.games },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        Average total SuperCoach points per game scored (For) and conceded (Against). Net is Against
        minus For: positive means a soft team to play.
      </p>
      <DataTable
        caption="Team SuperCoach points for and against"
        rows={data.teamTotals}
        columns={columns}
        rowKey={(row) => row.team}
        defaultSort={{ columnId: "net", direction: "desc" }}
        compact
        fitToViewport={false}
        empty="No games yet."
      />
    </div>
  );
}

/** Fixtures (default), Positions and Teams. */
export default function FixtureDifficultyTool({ data }: { data: FixtureDifficultyData }) {
  const [view, setView] = useState<View>("fixtures");
  const hasData = data.positions.some((row) => Object.keys(row.cells).length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs label="View" options={VIEWS} value={view} onChange={setView} />
        <Legend />
      </div>

      {!hasData && (
        <p role="status" className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-6 text-sm text-slate-300">
          Not enough games yet: values appear once players have played 5 games this season.
        </p>
      )}

      {view === "fixtures" && <FixturesView data={data} />}
      {view === "positions" && <PositionsView data={data} />}
      {view === "teams" && <TeamsView data={data} />}
    </div>
  );
}
