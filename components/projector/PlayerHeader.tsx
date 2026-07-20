import Image from "next/image";

import { getTeamLogo } from "@/lib/teams";

type PlayerHeaderProps = {
  name: string;
  team: string;
  teamName: string;
  positions: string[];
  availability: string | null;
};

export default function PlayerHeader({
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

        {availability && (
          <p className="mt-2 inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-sm font-medium text-amber-400">
            {availability}
          </p>
        )}
      </div>
    </div>
  );
}