import Link from "next/link";

import { shortPlayerName } from "@/lib/players/shortName";

type PlayerCellProps = {
  name: string;
  team: string;
  positions: readonly string[];
  /** Links the name (e.g. to the Projector). */
  href?: string;
};

/**
 * One-line player cell for DataTable: the short name on phones ("M. Gawn")
 * and the full name from the sm breakpoint up, then a small team badge and
 * positions. The full name is always the title and accessible label.
 */
export default function PlayerCell({ name, team, positions, href }: PlayerCellProps) {
  const label = (
    <>
      <span className="sm:hidden">{shortPlayerName(name)}</span>
      <span className="hidden sm:inline">{name}</span>
    </>
  );

  const nameClass =
    "min-w-0 truncate font-semibold text-white";

  return (
    <span className="flex min-w-0 items-center gap-1">
      {href ? (
        <Link
          href={href}
          title={name}
          aria-label={name}
          className={`${nameClass} rounded hover:text-brand-green focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green`}
        >
          {label}
        </Link>
      ) : (
        <span title={name} aria-label={name} className={nameClass}>
          {label}
        </span>
      )}

      <span
        title={team}
        className="shrink-0 rounded bg-slate-800 px-1 py-px text-[10px] font-bold leading-4 tracking-wide text-slate-300"
      >
        {team}
      </span>

      {positions.length > 0 && (
        <span className="shrink-0 text-[10px] leading-4 text-slate-400">
          {positions.join("/")}
        </span>
      )}
    </span>
  );
}
