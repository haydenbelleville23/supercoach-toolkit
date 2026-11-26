import Image from "next/image";

import AvailabilityBadge from "@/components/ui/AvailabilityBadge";
import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { availabilityFor } from "@/lib/availability";
import { getTeamLogo } from "@/lib/teams";

type PlayerHeaderProps = {
  id: number;
  name: string;
  team: string;
  teamName: string;
  positions: string[];
  availability: string | null;
};

export default function PlayerHeader({
  id,
  name,
  team,
  teamName,
  positions,
  availability,
}: PlayerHeaderProps) {
  return (
    <div className="flex items-center gap-6">
      <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-950 p-3">
        <Image
          src={getTeamLogo(team)}
          alt={`${teamName} logo`}
          width={96}
          height={96}
          className="h-full w-full object-contain"
        />
      </div>

      <div className="flex-1">
        <h2 className="text-4xl font-bold tracking-tight text-white">
          {name}
        </h2>

        <p className="mt-2 text-lg text-slate-400">
          {positions.join(" / ")} • {teamName}
        </p>

        <p className="mt-2">
          <AvailabilityBadge info={availabilityFor({ id, availability }, CURRENT_COMPLETED_ROUND + 1)} />
        </p>
      </div>
    </div>
  );
}