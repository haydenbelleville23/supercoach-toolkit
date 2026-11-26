import Link from "next/link";

import { shortPlayerName } from "@/lib/players/shortName";

type PlayerCellProps = {
  name: string;
  team: string;
  positions: readonly string[];
  /** Text for the small badge. Defaults to the team (e.g. "#12" instead). */
  badge?: string;
  /** Links the name (e.g. to the Projector). */
  href?: string;
};

/**
 * One-line player cell for DataTable: the short name on phones ("M. Gawn")
 * and the full name from the sm breakpoint up, then a small team badge.
 * Positions are in the tooltip, with the full name and team: shown inline
 * they truncated most full names at the 160px column width.
 */
export default function PlayerCell({ name, team, positions, badge = team, href }: PlayerCellProps) {
  const label = (
    <>
      <span className="sm:hidden">{shortPlayerName(name)}</span>
      <span className="hidden sm:inline">{name}</span>
    </>
  );

  const nameClass =
    "min-w-0 truncate text-[13px] font-semibold text-white sm:text-sm";

  const title = [name, team, positions.join("/")].filter(Boolean).join(" · ");

  return (
    <span className="flex min-w-0 items-center gap-1">
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

      <span
        aria-hidden="true"
        className="shrink-0 rounded bg-slate-800 px-1 text-[10px] font-bold leading-4 text-slate-300"
      >
        {badge}
      </span>

    </span>
  );
}
