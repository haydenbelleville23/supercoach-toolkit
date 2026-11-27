"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const label = (round: number) => (round === 0 ? "Opening Round" : `Round ${round}`);

/**
 * Prev / next arrows and a round list. Links work without JavaScript; the
 * list navigates on change. A season list appears only when more than one
 * season has results.
 */
export default function RoundSelector({
  season,
  seasons,
  rounds,
  round,
  currentSeason,
}: {
  season: number;
  seasons: number[];
  rounds: number[];
  round: number;
  currentSeason: number;
}) {
  const router = useRouter();
  const index = rounds.indexOf(round);
  const prev = index > 0 ? rounds[index - 1] : null;
  const next = index < rounds.length - 1 ? rounds[index + 1] : null;

  const href = (r: number, s = season) =>
    `/live/results?${s === currentSeason ? "" : `season=${s}&`}round=${r}`;

  const arrow =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-200 transition hover:border-slate-500 hover:text-white";
  const select =
    "h-11 min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-white outline-none focus:border-violet-500";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {seasons.length > 1 && (
        <select
          aria-label="Season"
          value={season}
          onChange={(e) => router.push(`/live/results?season=${e.target.value}`)}
          className={select}
        >
          {seasons.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
        {prev !== null ? (
          <Link href={href(prev)} aria-label={`Previous: ${label(prev)}`} className={arrow}>
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </Link>
        ) : (
          <span aria-hidden="true" className={`${arrow} opacity-30`}>
            <ChevronLeft className="h-5 w-5" />
          </span>
        )}

        <select
          aria-label="Round"
          value={round}
          onChange={(e) => router.push(href(Number(e.target.value)))}
          className={`${select} flex-1 sm:w-48 sm:flex-none`}
        >
          {rounds.map((r) => (
            <option key={r} value={r}>
              {label(r)}
            </option>
          ))}
        </select>

        {next !== null ? (
          <Link href={href(next)} aria-label={`Next: ${label(next)}`} className={arrow}>
            <ChevronRight aria-hidden="true" className="h-5 w-5" />
          </Link>
        ) : (
          <span aria-hidden="true" className={`${arrow} opacity-30`}>
            <ChevronRight className="h-5 w-5" />
          </span>
        )}
      </div>
    </div>
  );
}
