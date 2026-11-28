import Link from "next/link";
import type { ReactNode } from "react";

import { shortPlayerName } from "@/lib/players/shortName";

import TeamLogo, { TEAM_LOGO_SIZE } from "./TeamLogo";

type PlayerCellProps = {
  name: string;
  team: string;
  positions: readonly string[];
  /** Extra small text badge on the second line (e.g. "#12" on Live). Null or omitted for none. */
  badge?: string | null;
  /** Links the name (e.g. to the Projector). */
  href?: string;
  /** On the second line, after the positions (e.g. an availability badge or live tag). */
  trailing?: ReactNode;
  /** Before the logo (e.g. a watchlist star). */
  leading?: ReactNode;
};

/**
 * Player cell for DataTable: the club logo, then the name (short name on
 * phones, "M. Gawn"; full name from the sm breakpoint up), which wraps at
 * spaces and hyphens onto a second line rather than being cut off. Below
 * it, the positions and any status badge, so status never competes with
 * the name for width. The full name, club and positions are in the
 * tooltip, and the full name is the link's accessible name.
 */
export default function PlayerCell({ name, team, positions, badge = null, href, trailing, leading }: PlayerCellProps) {
  const label = (
    <>
      <span className="sm:hidden">{shortPlayerName(name)}</span>
      <span className="hidden sm:inline">{name}</span>
    </>
  );

  // whitespace-normal undoes the table's nowrap; break-words only splits
  // a word when a single word is wider than the column.
  const nameClass =
    "block min-w-0 whitespace-normal break-words text-[13px] font-semibold leading-snug text-white sm:text-sm";

  const title = [name, team, positions.join("/")].filter(Boolean).join(" · ");

  return (
    <span className="flex min-w-0 items-start gap-1.5">
      {leading}

      <TeamLogo team={team} size={TEAM_LOGO_SIZE.table} className="mt-px" />

      <span className="flex min-w-0 flex-1 flex-col">
        {href ? (
          <Link
            href={href}
            title={title}
            aria-label={name}
            className={`${nameClass} rounded hover:text-brand-green focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green`}
          >
            {label}
          </Link>
        ) : (
          <span title={title} aria-label={name} className={nameClass}>
            {label}
          </span>
        )}

        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1 text-[11px] leading-4 text-slate-400">
          {positions.length > 0 && <span>{positions.join("/")}</span>}

          {badge !== null && (
            <span
              aria-hidden="true"
              className="shrink-0 rounded bg-slate-800 px-1 text-[10px] font-bold leading-4 text-slate-300"
            >
              {badge}
            </span>
          )}

          {trailing}
        </span>
      </span>
    </span>
  );
}
