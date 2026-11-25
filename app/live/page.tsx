"use client";

import Link from "next/link";
import DataFreshness from "@/components/layout/DataFreshness";
import Header from "@/components/layout/Header";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { getFixtures } from "@/lib/fixtures";
import { formatChange, formatMoney } from "@/lib/format";
import {
  buildLiveRoundContext,
  calculateLiveMatch,
  getFixtureState,
} from "@/lib/liveMatch";
import { getScaledRoundContexts } from "@/lib/projector/getScaledRoundContexts";
import { playerRepository } from "@/lib/repository/PlayerRepository";

import type {
  DfsLiveFeed,
  DfsLiveFixture,
  DfsLivePlayer,
  LivePlayerProjection,
  LiveScoreOverrides,
} from "@/lib/liveMatch";

const players = playerRepository.getAll();

const scheduledFixtures = getFixtures() as Array<{
  id?: number;
  round: number;
  homeTeam: string;
  awayTeam: string;
  kickoff?: string;
  location?: string;
}>;

const REFRESH_INTERVAL_MS = 30_000;

type FeedState = {
  data: DfsLiveFeed | null;
  loading: boolean;
  error: string | null;
};

type TeamTab = "home" | "away";

type DisplayRow = {
  player: (typeof players)[number];
  livePlayer: DfsLivePlayer;
  projection: LivePlayerProjection;
  effectiveScore: number;
};


function getChangeColour(
  value: number,
): string {
  if (value > 0) {
    return "text-emerald-400";
  }

  if (value < 0) {
    return "text-red-400";
  }

  return "text-slate-400";
}

function getTeamLogo(team: string): string {
  return `/teams/${team.toLowerCase()}.png`;
}

/** The round the live feed is expected to be playing. */
const LIVE_ROUND = CURRENT_COMPLETED_ROUND + 1;

function isScheduledGame(
  homeTeam: string,
  awayTeam: string,
  round: number,
): boolean {
  return scheduledFixtures.some(
    (scheduled) =>
      scheduled.round === round &&
      scheduled.homeTeam === homeTeam &&
      scheduled.awayTeam === awayTeam,
  );
}

function getScheduleFixture(
  fixture: DfsLiveFixture,
) {
  const matches = scheduledFixtures.filter(
    (scheduled) =>
      scheduled.homeTeam ===
        fixture.homeTeam &&
      scheduled.awayTeam ===
        fixture.awayTeam,
  );

  // Prefer this round's game over the same pairing earlier in the season.
  return (
    matches.find(
      (scheduled) =>
        scheduled.round === LIVE_ROUND,
    ) ?? matches[matches.length - 1]
  );
}

function getFixtureTimeLabel(
  fixture: DfsLiveFixture,
): string {
  const state = getFixtureState(fixture);

  if (state === "live") {
    return "LIVE";
  }

  if (state === "finished") {
    return "FINAL";
  }

  const scheduled =
    getScheduleFixture(fixture);

  if (!scheduled?.kickoff) {
    return "Upcoming";
  }

  const kickoff = new Date(
    scheduled.kickoff,
  );

  const day = kickoff
    .toLocaleDateString("en-AU", {
      weekday: "short",
    })
    .toUpperCase();

  const time = kickoff.toLocaleTimeString(
    "en-AU",
    {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    },
  );

  return `${day} ${time}`;
}

function getStatusLabel(
  fixture: DfsLiveFixture,
): string {
  const state = getFixtureState(fixture);

  if (state === "finished") {
    return "FULL TIME";
  }

  if (state === "live") {
    if (fixture.timeRemaining) {
      return fixture.timeRemaining;
    }

    return `${fixture.progress}% complete`;
  }

  return "UPCOMING";
}

function getMarginLabel(
  fixture: DfsLiveFixture,
): string {
  const state = getFixtureState(fixture);

  if (
    state === "upcoming" ||
    fixture.homeScore === null ||
    fixture.awayScore === null
  ) {
    return "";
  }

  const margin = Math.abs(
    fixture.homeScore -
      fixture.awayScore,
  );

  if (margin === 0) {
    return "Scores level";
  }

  const winningTeam =
    fixture.homeScore >
    fixture.awayScore
      ? fixture.homeTeam
      : fixture.awayTeam;

  if (state === "finished") {
    return `${winningTeam} won by ${margin}`;
  }

  return `${winningTeam} lead by ${margin}`;
}

function getFixtureVenue(
  fixture: DfsLiveFixture,
): string {
  if (fixture.venue) {
    return fixture.venue;
  }

  return (
    getScheduleFixture(fixture)
      ?.location ?? ""
  );
}

function getFixtureStatusClasses(
  fixture: DfsLiveFixture,
): string {
  const state = getFixtureState(fixture);

  if (state === "live") {
    return "border-emerald-500/60 bg-emerald-500/10";
  }

  if (state === "finished") {
    return "border-slate-700 bg-slate-900";
  }

  return "border-slate-800 bg-slate-900";
}

/** Shared header and title, so loading and error states keep the layout. */
function LiveLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />

      <section className="mx-auto max-w-7xl px-6 pt-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            2026 season
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Live Scores
          </h1>

          <p className="mt-4 text-slate-300">
            Live SuperCoach scores with projected end-of-round prices and breakevens.
          </p>

          <DataFreshness />
        </div>
      </section>

      {children}
    </main>
  );
}

function LiveLoadingState() {
  return (
    <section
      aria-busy="true"
      className="mx-auto max-w-7xl px-6 py-8"
    >
      <span className="sr-only">Loading live scores</span>

      <div className="flex gap-3 overflow-hidden pb-3">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-[104px] min-w-[170px] animate-pulse rounded-xl border border-slate-800 bg-slate-900"
          />
        ))}
      </div>

      <div className="mt-5 h-[210px] animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />

      <div className="mt-6 h-64 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
    </section>
  );
}

function LiveMessage({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-8">
      <div
        role={tone === "error" ? "alert" : "status"}
        className={`rounded-2xl border px-6 py-8 text-center ${
          tone === "error"
            ? "border-red-500/40 bg-red-500/10 text-red-300"
            : "border-slate-800 bg-slate-900 text-slate-300"
        }`}
      >
        {children}
      </div>
    </section>
  );
}

export default function LivePage() {
  const [feedState, setFeedState] =
    useState<FeedState>({
      data: null,
      loading: true,
      error: null,
    });

  const [
    selectedFixtureId,
    setSelectedFixtureId,
  ] = useState<number | null>(null);

  const [selectedTeam, setSelectedTeam] =
    useState<TeamTab>("home");

  const [manualScores, setManualScores] =
    useState<LiveScoreOverrides>({});

  useEffect(() => {
    let cancelled = false;

    async function loadLiveScores() {
      try {
        const response = await fetch(
          "/api/live-scores",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            "Could not load live scores.",
          );
        }

        const feed =
          (await response.json()) as DfsLiveFeed;

        if (cancelled) {
          return;
        }

        setFeedState({
          data: feed,
          loading: false,
          error: null,
        });

        setSelectedFixtureId(
          (current) => {
            if (
              current !== null &&
              feed.fixtures.some(
                (fixture) =>
                  fixture.id === current,
              )
            ) {
              return current;
            }

            const liveFixture =
              feed.fixtures.find(
                (fixture) =>
                  getFixtureState(fixture) ===
                  "live",
              );

            const concludedFixture =
              feed.fixtures.find(
                (fixture) =>
                  getFixtureState(fixture) ===
                  "finished",
              );

            return (
              liveFixture?.id ??
              concludedFixture?.id ??
              feed.fixtures[0]?.id ??
              null
            );
          },
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setFeedState((current) => ({
          ...current,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not load live scores.",
        }));
      }
    }

    loadLiveScores();

    const interval =
      window.setInterval(
        loadLiveScores,
        REFRESH_INTERVAL_MS,
      );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const fixtures =
    feedState.data?.fixtures ?? [];

  const selectedFixture =
    fixtures.find(
      (fixture) =>
        fixture.id ===
        selectedFixtureId,
    ) ?? null;

  const selectedLivePlayers =
    useMemo(() => {
      if (
        !feedState.data ||
        !selectedFixture
      ) {
        return [];
      }

      return feedState.data.players.filter(
        (player) =>
          player.fixtureId ===
          selectedFixture.id,
      );
    }, [
      feedState.data,
      selectedFixture,
    ]);

  const matchedPlayers = useMemo(() => {
    const liveByChampionDataId =
      new Map(
        selectedLivePlayers.map(
          (player) => [
            player.championDataId,
            player,
          ],
        ),
      );

    return players
      .filter(
        (player) =>
          player.championDataId !==
            null &&
          liveByChampionDataId.has(
            player.championDataId,
          ),
      )
      .map((player) => ({
        player,

        livePlayer:
          liveByChampionDataId.get(
            player.championDataId as string,
          )!,
      }));
  }, [selectedLivePlayers]);

  const effectiveScores =
    useMemo<LiveScoreOverrides>(() => {
      const scores: LiveScoreOverrides =
        {};

      for (const entry of matchedPlayers) {
        scores[entry.player.id] =
          manualScores[
            entry.player.id
          ] ??
          entry.livePlayer
            .superCoachPoints;
      }

      return scores;
    }, [
      matchedPlayers,
      manualScores,
    ]);

  // The round's k, updated with scores from finished games (and any
  // entered scores) across the whole feed, not just the selected game.
  const liveContext = useMemo(() => {
    const baseContext =
      getScaledRoundContexts().get(LIVE_ROUND);

    if (!baseContext || !feedState.data) {
      return baseContext;
    }

    return buildLiveRoundContext({
      baseContext,
      round: LIVE_ROUND,
      feed: feedState.data,
      players,
      manualScores,
      isScheduledGame,
    }).context;
  }, [feedState.data, manualScores]);

  const projections = useMemo(
    () =>
      calculateLiveMatch(
        matchedPlayers.map(
          (entry) => entry.player,
        ),
        effectiveScores,
        liveContext,
      ),
    [
      matchedPlayers,
      effectiveScores,
      liveContext,
    ],
  );

  const displayRows =
    useMemo<DisplayRow[]>(() => {
      const projectionByPlayerId =
        new Map(
          projections.map(
            (projection) => [
              projection.player.id,
              projection,
            ],
          ),
        );

      return matchedPlayers
        .map((entry) => {
          const projection =
            projectionByPlayerId.get(
              entry.player.id,
            );

          if (!projection) {
            return null;
          }

          return {
            ...entry,
            projection,

            effectiveScore:
              effectiveScores[
                entry.player.id
              ] ??
              entry.livePlayer
                .superCoachPoints,
          };
        })
        .filter(
          (
            row,
          ): row is DisplayRow =>
            row !== null,
        );
    }, [
      matchedPlayers,
      projections,
      effectiveScores,
    ]);

  const activeTeam =
    selectedFixture === null
      ? null
      : selectedTeam === "home"
        ? selectedFixture.homeTeam
        : selectedFixture.awayTeam;

  const visibleRows = useMemo(
    () =>
      displayRows
        .filter(
          (row) =>
            row.livePlayer.team ===
            activeTeam,
        )
        .sort(
          (a, b) =>
            b.effectiveScore -
            a.effectiveScore,
        ),
    [displayRows, activeTeam],
  );

  const homePlayerCount =
    displayRows.filter(
      (row) =>
        row.livePlayer.team ===
        selectedFixture?.homeTeam,
    ).length;

  const awayPlayerCount =
    displayRows.filter(
      (row) =>
        row.livePlayer.team ===
        selectedFixture?.awayTeam,
    ).length;

  function updateLiveScore(
    playerId: number,
    value: string,
  ) {
    const cleanedValue =
      value.replace(/[^0-9]/g, "");

    setManualScores((current) => {
      if (cleanedValue === "") {
        const updated = {
          ...current,
        };

        delete updated[playerId];

        return updated;
      }

      const score = Number(cleanedValue);

      if (!Number.isFinite(score)) {
        return current;
      }

      return {
        ...current,
        [playerId]: score,
      };
    });
  }

  function handleFixtureChange(
    fixtureId: number,
  ) {
    setSelectedFixtureId(fixtureId);
    setSelectedTeam("home");
    setManualScores({});
  }

  if (feedState.loading) {
    return (
      <LiveLayout>
        <LiveLoadingState />
      </LiveLayout>
    );
  }

  if (
    feedState.error ||
    !feedState.data
  ) {
    return (
      <LiveLayout>
        <LiveMessage tone="error">
          {feedState.error ??
            "Live scores are unavailable."}{" "}
          They refresh every 30 seconds.
        </LiveMessage>
      </LiveLayout>
    );
  }

  if (!selectedFixture) {
    return (
      <LiveLayout>
        <LiveMessage>
          No games are in the live feed right
          now. Check back when the next round
          starts.
        </LiveMessage>
      </LiveLayout>
    );
  }

  const marginLabel =
    getMarginLabel(selectedFixture);

  const venue =
    getFixtureVenue(selectedFixture);

  return (
    <LiveLayout>
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex gap-3 overflow-x-auto pb-3">
          {fixtures.map((fixture) => {
            const isSelected =
              fixture.id ===
              selectedFixture.id;

            return (
              <button
                key={fixture.id}
                type="button"
                onClick={() =>
                  handleFixtureChange(
                    fixture.id,
                  )
                }
                className={`min-w-[170px] rounded-xl border px-4 py-3 text-left transition ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10"
                    : getFixtureStatusClasses(
                        fixture,
                      )
                } hover:border-slate-600`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {getFixtureTimeLabel(
                      fixture,
                    )}
                  </p>

                  {getFixtureState(fixture) ===
                    "live" && (
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  )}
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <img
                      src={getTeamLogo(
                        fixture.homeTeam,
                      )}
                      alt=""
                      className="h-5 w-5 object-contain"
                      onError={(event) => {
                        event.currentTarget.style.display =
                          "none";
                      }}
                    />

                    <span className="font-semibold">
                      {fixture.homeTeam}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <img
                      src={getTeamLogo(
                        fixture.awayTeam,
                      )}
                      alt=""
                      className="h-5 w-5 object-contain"
                      onError={(event) => {
                        event.currentTarget.style.display =
                          "none";
                      }}
                    />

                    <span className="font-semibold">
                      {fixture.awayTeam}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950">
          <div className="grid min-h-[210px] grid-cols-[1fr_auto_1fr] items-center gap-5 px-6 py-8 sm:px-10">
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <img
                src={getTeamLogo(
                  selectedFixture.homeTeam,
                )}
                alt={`${selectedFixture.homeTeam} logo`}
                className="h-20 w-20 object-contain"
                onError={(event) => {
                  event.currentTarget.style.display =
                    "none";
                }}
              />

              <div className="text-center sm:text-left">
                <p className="text-2xl font-bold">
                  {selectedFixture.homeTeam}
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Home
                </p>
              </div>
            </div>

            <div className="min-w-[220px] text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
                {getStatusLabel(
                  selectedFixture,
                )}
              </p>

              <div className="mt-3 flex items-center justify-center gap-5">
                <span className="text-4xl font-bold tabular-nums sm:text-5xl">
                  {selectedFixture.homeScore ??
                    0}
                </span>

                <span className="text-sm font-bold text-slate-400">
                  VS
                </span>

                <span className="text-4xl font-bold tabular-nums sm:text-5xl">
                  {selectedFixture.awayScore ??
                    0}
                </span>
              </div>

              {marginLabel && (
                <p className="mt-3 text-lg font-semibold">
                  {marginLabel}
                </p>
              )}

              {venue && (
                <p className="mt-1 text-sm text-slate-400">
                  {venue}
                </p>
              )}

              <p className="mt-2 text-xs text-slate-400">
                Updated{" "}
                {feedState.data
                  .updatedAt ?? "recently"}
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 sm:flex-row-reverse">
              <img
                src={getTeamLogo(
                  selectedFixture.awayTeam,
                )}
                alt={`${selectedFixture.awayTeam} logo`}
                className="h-20 w-20 object-contain"
                onError={(event) => {
                  event.currentTarget.style.display =
                    "none";
                }}
              />

              <div className="text-center sm:text-right">
                <p className="text-2xl font-bold">
                  {selectedFixture.awayTeam}
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Away
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() =>
                setSelectedTeam("home")
              }
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
                selectedTeam === "home"
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {selectedFixture.homeTeam}
              <span className="ml-2 opacity-70">
                {homePlayerCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setSelectedTeam("away")
              }
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
                selectedTeam === "away"
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {selectedFixture.awayTeam}
              <span className="ml-2 opacity-70">
                {awayPlayerCount}
              </span>
            </button>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="sticky left-0 z-30 bg-slate-950 px-4 py-3">
                    Player
                  </th>

                  <th className="px-3 py-3 text-right">
                    Live SC
                  </th>

                  <th className="px-3 py-3 text-right">
                    TOG
                  </th>

                  <th className="px-3 py-3 text-right">
                    BE
                  </th>

                  <th className="px-3 py-3 text-right">
                    Current Price
                  </th>

                  <th className="px-3 py-3 text-right">
                    Projected Price
                  </th>

                  <th className="px-3 py-3 text-right">
                    Δ Round
                  </th>

                  <th className="px-3 py-3 text-right">
                    Next BE
                  </th>
                </tr>
              </thead>

              <tbody>
                {visibleRows.map(
                  ({
                    player,
                    livePlayer,
                    projection,
                    effectiveScore,
                  }) => (
                    <tr
                      key={player.id}
                      className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40"
                    >
                      <td className="sticky left-0 z-10 bg-slate-900 px-4 py-3">
                        <Link
                          href={`/projector?player=${player.id}`}
                          className="font-semibold hover:text-emerald-400"
                        >
                          {player.name}
                        </Link>

                        <div className="mt-0.5 text-xs text-slate-400">
                          #{livePlayer.jumperNumber}
                          {" · "}
                          {player.positions.join(
                            "/",
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-right">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            manualScores[
                              player.id
                            ] ??
                            effectiveScore
                          }
                          onChange={(event) =>
                            updateLiveScore(
                              player.id,
                              event.target
                                .value,
                            )
                          }
                          onFocus={(event) =>
                            event.currentTarget.select()
                          }
                          aria-label={`${player.name} projected final score`}
                          className={`w-14 rounded border px-2 py-1.5 text-center font-bold tabular-nums outline-none ${
                            manualScores[
                              player.id
                            ] !== undefined
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                              : "border-slate-700 bg-slate-950 text-white"
                          }`}
                        />
                      </td>

                      <td className="px-3 py-3 text-right tabular-nums text-slate-300">
                        {
                          livePlayer.timeOnGroundPercentage
                        }
                        %
                      </td>

                      <td className="px-3 py-3 text-right tabular-nums">
                        {
                          projection.currentBreakEven
                        }
                      </td>

                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatMoney(
                          projection.currentPrice,
                        )}
                      </td>

                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {formatMoney(
                          projection.projectedPrice,
                        )}
                      </td>

                      <td
                        className={`px-3 py-3 text-right font-semibold tabular-nums ${getChangeColour(
                          projection.projectedPriceChange,
                        )}`}
                      >
                        {formatChange(
                          projection.projectedPriceChange,
                        )}
                      </td>

                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {projection.nextBreakEven ??
                          "-"}
                      </td>
                    </tr>
                  ),
                )}

                {visibleRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-slate-400"
                    >
                      No matched players were
                      found for this team.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs leading-5 text-slate-400">
            Live SuperCoach scores refresh
            automatically every 30 seconds.
            Editing a score creates a temporary
            override and immediately recalculates
            the player&apos;s projected price and
            next break-even. Live scoring supplied
            through DFS Australia.
          </p>
        </section>
      </section>
    </LiveLayout>
  );
}