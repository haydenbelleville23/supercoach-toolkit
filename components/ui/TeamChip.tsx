import Image from "next/image";

import { getTeam } from "@/lib/teams";

/**
 * A team's logo, as shown in the Projector's player search. Decorative
 * (the team is always named in text nearby). A player with no team, such
 * as a Rookie (TBC) placeholder, gets a plain empty circle.
 */
export default function TeamChip({
  team,
  size = 24,
  className = "",
}: {
  team: string;
  /** Pixel size (square). */
  size?: number;
  className?: string;
}) {
  const known = getTeam(team);

  if (!known) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={`inline-block shrink-0 rounded-full border border-dashed border-slate-600 ${className}`}
      />
    );
  }

  return (
    <Image
      src={known.logo}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
