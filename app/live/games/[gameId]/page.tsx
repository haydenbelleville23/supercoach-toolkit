import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import Header from "@/components/layout/Header";
import GameTeamTable from "@/components/live/GameTeamTable";
import TeamChip from "@/components/ui/TeamChip";
import { formatKickoff, resultLine, roundLabel } from "@/lib/games/format";
import { hasTogData } from "@/lib/games/stats";
import { findGame, readRoundGames, SEASON_YEAR, seasonsWithGames, visibleRoundsFor } from "@/lib/games/read";
import type { Game, GameTeamScore } from "@/lib/games/types";

type Params = Promise<{ gameId: string }>;

// Only games in visible rounds exist; any other id is not found.
export const dynamicParams = false;

export function generateStaticParams(): { gameId: string }[] {
  return seasonsWithGames().flatMap((season) =>
    visibleRoundsFor(season).flatMap(
      (round) => readRoundGames(season, round)?.games.map((g) => ({ gameId: g.id })) ?? [],
    ),
  );
}

const title = (game: Game) =>
  `${game.home.teamName} v ${game.away.teamName}, ${roundLabel(game.round)} ${game.season}`;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const game = findGame((await params).gameId);
  if (!game) return { title: "Game not found" };

  return {
    title: title(game),
    description: `${game.home.teamName} ${game.home.total} v ${game.away.teamName} ${game.away.total} (${resultLine(game)}): AFL SuperCoach scores and player stats.`,
  };
}

function Side({ score, won, align }: { score: GameTeamScore; won: boolean; align: "left" | "right" }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-1 ${align === "right" ? "items-end text-right" : "items-start"}`}>
      <TeamChip team={score.team} size={40} />
      <span className={`max-w-full truncate text-sm ${won ? "font-bold text-white" : "font-medium text-slate-300"}`}>
        {score.teamName}
      </span>
      <span className={`tabular-nums ${won ? "text-3xl font-bold text-white" : "text-2xl font-semibold text-slate-300"}`}>
        {score.total}
      </span>
      <span className="text-xs tabular-nums text-slate-400">
        {score.goals}.{score.behinds}
      </span>
    </div>
  );
}

export default async function GamePage({ params }: { params: Params }) {
  const game = findGame((await params).gameId);
  if (!game) notFound();

  const draw = game.winner === null;
  const showTog = hasTogData([...game.players.home, ...game.players.away]);
  const backHref = `/live/results?${game.season === SEASON_YEAR ? "" : `season=${game.season}&`}round=${game.round}`;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />

      <section className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6">
        <Link href={backHref} className="text-sm font-semibold text-violet-300 hover:text-violet-200">
          ← {roundLabel(game.round)} {game.season} results
        </Link>

        <h1 className="sr-only">{title(game)}</h1>

        {/* Scoreboard */}
        <section aria-label="Final score" className="mt-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <Side score={game.home} won={game.winner === game.home.team || draw} align="left" />
            <div className="flex shrink-0 flex-col items-center gap-1 pt-3 text-center">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {roundLabel(game.round)}
              </span>
              <span className={`text-sm font-bold ${draw ? "text-amber-300" : "text-white"}`}>{resultLine(game)}</span>
            </div>
            <Side score={game.away} won={game.winner === game.away.team || draw} align="right" />
          </div>
          <p className="mt-4 border-t border-slate-800 pt-3 text-center text-xs text-slate-400">
            {game.venue} · <time dateTime={game.kickoff}>{formatKickoff(game.kickoff)}</time> (Melbourne time)
          </p>
        </section>

        <div className="mt-6 space-y-8">
          <GameTeamTable teamName={game.home.teamName} team={game.home.team} players={game.players.home} showTog={showTog} />
          <GameTeamTable teamName={game.away.teamName} team={game.away.team} players={game.players.away} showTog={showTog} />
        </div>

        <p className="mt-6 text-xs leading-5 text-slate-400">
          SC is the SuperCoach score; D disposals, K kicks, HB handballs, M marks, T tackles, MIN minutes,
          TOG% time on ground, HO hitouts, G goals; ± Price is that round&apos;s published price change.
          Scores and stats from SuperCoach&apos;s public site.
        </p>
      </section>
    </main>
  );
}
