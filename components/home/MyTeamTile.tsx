"use client";

import { Users } from "lucide-react";
import Link from "next/link";

import { useMyTeam } from "@/lib/planner/useMyTeam";

/**
 * The home page's primary tile. Reads the team saved in this browser
 * (localStorage); during server rendering, or when storage is blocked,
 * useMyTeam returns null and the tile offers to add a team.
 */
export default function MyTeamTile() {
  const team = useMyTeam();
  const count = team?.players.length ?? 0;
  const hasTeam = team !== null && count > 0;

  return (
    <Link
      href="/my-team"
      className="group flex h-full flex-col rounded-2xl border-2 border-brand-green/70 bg-brand-navy p-6 shadow-lg shadow-black/30 motion-safe:transition hover:border-brand-green focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-green/15 text-brand-green">
          <Users aria-hidden="true" className="h-6 w-6" />
        </span>
        <span className="rounded-full bg-brand-green px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-brand-navy">
          Start here
        </span>
      </div>

      <h2 className="mt-5 text-xl font-bold text-white">My Team</h2>

      <p className="mt-2 text-sm leading-6 text-slate-300">
        Add your squad once and every tool works from it, and keep a watchlist.
      </p>

      <div className="mt-auto pt-5">
        {hasTeam && (
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-white">{count}</span>{" "}
            {count === 1 ? "player" : "players"} saved
          </p>
        )}

        <span className="mt-2 inline-flex items-center gap-1 font-semibold text-brand-green">
          {hasTeam ? "Edit team" : "Add your team"}
          <span aria-hidden="true" className="motion-safe:transition group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}
