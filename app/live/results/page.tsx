import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Header from "@/components/layout/Header";
import PageHeader from "@/components/layout/PageHeader";
import GameCard from "@/components/live/GameCard";
import LiveViewToggle from "@/components/live/LiveViewToggle";
import RoundSelector from "@/components/live/RoundSelector";
import { byeTeams, roundLabel } from "@/lib/games/format";
import { readRoundGames, SEASON_YEAR, seasonsWithGames, visibleRoundsFor } from "@/lib/games/read";
import { TEAMS } from "@/lib/teams";

type SearchParams = Promise<{ season?: string; round?: string }>;

/**
 * The season and round asked for, or null when out of range. Defaults: the
 * latest season with completed games (last season's during a new
 * preseason), and its latest round.
 */
function resolve(params: { season?: string; round?: string }) {
  const season = params.season === undefined ? (seasonsWithGames()[0] ?? SEASON_YEAR) : Number(params.season);
  if (!Number.isInteger(season)) return null;

  const rounds = visibleRoundsFor(season);
  // Before the first round of this season: "no results yet". Any other
  // season without results doesn't exist.
  if (rounds.length === 0) return season === SEASON_YEAR ? { season, rounds, round: null } : null;

  const round = params.round === undefined ? rounds[rounds.length - 1] : Number(params.round);
  if (!rounds.includes(round)) return null;

  return { season, rounds, round };
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const picked = resolve(await searchParams);
  const where = picked?.round != null ? `${roundLabel(picked.round)} ${picked.season}` : `${SEASON_YEAR}`;

  return {
    title: `${where} results`,
    description: `AFL SuperCoach results for ${where}: final scores and every player's SuperCoach score and stats.`,
  };
}

export default async function ResultsPage({ searchParams }: { searchParams: SearchParams }) {
  const picked = resolve(await searchParams);
  if (!picked) notFound();

  const file = picked.round === null ? null : readRoundGames(picked.season, picked.round);
  if (picked.round !== null && !file) notFound();

  const byes = file ? byeTeams(file.games) : [];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />

      <section className="mx-auto max-w-7xl px-6 pt-12">
        <PageHeader
          title="Live Scores"
          description="Live SuperCoach scores with projected end-of-round prices and breakevens."
        />
        <LiveViewToggle active="results" />
      </section>

      <section className="mx-auto max-w-7xl px-6 py-6">
        {picked.round === null || !file ? (
          <p role="status" className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-8 text-center text-slate-300">
            No results yet for {picked.season}.
          </p>
        ) : (
          <>
            <RoundSelector
              season={picked.season}
              seasons={seasonsWithGames()}
              rounds={picked.rounds}
              round={picked.round}
              currentSeason={SEASON_YEAR}
            />

            <h2 className="mt-5 text-lg font-semibold">
              {roundLabel(picked.round)} {picked.season}
              <span className="ml-2 text-sm font-normal text-slate-400">
                {file.games.length} game{file.games.length === 1 ? "" : "s"}
              </span>
            </h2>

            {byes.length > 0 && (
              <p className="mt-1 text-sm text-slate-400">
                Bye: {byes.map((code) => TEAMS[code]?.name ?? code).join(", ")}
              </p>
            )}

            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {file.games.map((game) => (
                <li key={game.id}>
                  <GameCard game={game} />
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-6 text-xs text-slate-400">
          Scores and stats from SuperCoach&apos;s public site. Times are Melbourne time.
        </p>
      </section>
    </main>
  );
}
