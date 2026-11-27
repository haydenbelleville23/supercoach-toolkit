import Link from "next/link";

import TeamChip from "@/components/ui/TeamChip";
import { formatKickoff, resultLine } from "@/lib/games/format";
import type { Game, GameTeamScore } from "@/lib/games/types";

function TeamLine({ score, won }: { score: GameTeamScore; won: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${won ? "text-white" : "text-slate-400"}`}>
      <TeamChip team={score.team} size={22} />
      <span className={`min-w-0 flex-1 truncate ${won ? "font-bold" : "font-medium"}`}>{score.teamName}</span>
      <span className="shrink-0 text-xs tabular-nums text-slate-400">
        {score.goals}.{score.behinds}
      </span>
      <span className={`w-9 shrink-0 text-right tabular-nums ${won ? "text-lg font-bold" : "text-base font-semibold"}`}>
        {score.total}
      </span>
    </div>
  );
}

/** One result: both teams with goals.behinds and total, winner in bold, venue and time. */
export default function GameCard({ game }: { game: Game }) {
  const draw = game.winner === null;

  return (
    <Link
      href={`/live/games/${game.id}`}
      aria-label={`${game.home.teamName} ${game.home.total} v ${game.away.teamName} ${game.away.total}: ${resultLine(game)}. Player stats.`}
      className="block rounded-xl border border-slate-800 bg-slate-900 p-3 transition hover:border-violet-500/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      <div className="space-y-1.5">
        <TeamLine score={game.home} won={game.winner === game.home.team || draw} />
        <TeamLine score={game.away} won={game.winner === game.away.team || draw} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-t border-slate-800 pt-2 text-xs text-slate-400">
        <span className={draw ? "font-semibold text-amber-300" : "font-semibold text-slate-200"}>{resultLine(game)}</span>
        <span className="min-w-0 truncate">
          {game.venue} · <time dateTime={game.kickoff}>{formatKickoff(game.kickoff)}</time>
        </span>
      </div>
    </Link>
  );
}
