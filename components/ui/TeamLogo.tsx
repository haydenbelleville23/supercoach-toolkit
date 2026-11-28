"use client";

import Image from "next/image";
import { useState } from "react";

import { getTeam } from "@/lib/teams";

/** Sizes used across the site: tables and trade rows, compact cards, dropdown rows. */
export const TEAM_LOGO_SIZE = { table: 20, compact: 18, dropdown: 24 } as const;

/**
 * A club's logo from public/teams. alt is the full club name and the
 * title is the club code. If the image is missing or fails to load, the
 * club code is shown as a small text chip instead. A player with no club
 * (a Rookie (TBC) placeholder) gets a plain dashed circle.
 *
 * The logo never carries meaning alone: the club is also in the player's
 * tooltip or accessible name wherever this is used.
 */
export default function TeamLogo({
  team,
  size = TEAM_LOGO_SIZE.table,
  className = "",
}: {
  team: string;
  /** Pixel size (square). */
  size?: number;
  className?: string;
}) {
  const known = getTeam(team ?? "");
  const [failed, setFailed] = useState(false);

  if (!known) {
    return (
      <span
        aria-hidden="true"
        data-testid="team-logo-none"
        style={{ width: size, height: size }}
        className={`inline-block shrink-0 rounded-full border border-dashed border-slate-600 ${className}`}
      />
    );
  }

  if (failed) {
    return <TeamCodeChip team={known.code} name={known.name} className={className} />;
  }

  return (
    <Image
      src={known.logo}
      alt={known.name}
      title={known.code}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

/** The small text club chip (e.g. "COL"): TeamLogo's fallback. */
export function TeamCodeChip({
  team,
  name,
  className = "",
}: {
  team: string;
  name?: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={name ?? team}
      title={team}
      className={`inline-block shrink-0 rounded bg-slate-800 px-1 text-[10px] font-bold leading-4 text-slate-300 ${className}`}
    >
      {team}
    </span>
  );
}
