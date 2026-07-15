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
    <div className="text-center">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-xl bg-slate-950 p-2">
        <Image
          src={getTeamLogo(team)}
          alt={`${teamName} logo`}
          width={80}
          height={80}
          className="h-full w-full object-contain"
        />
      </div>

      <div className="mt-3">
        <h2 className="text-3xl font-bold">{name}</h2>

        <p className="mt-1 text-slate-400">
          {positions.join(" / ")} · {teamName}
        </p>

        {availability && (
          <p className="mt-1 text-xs font-medium text-amber-400">
            {availability}
          </p>
        )}
      </div>
    </div>
  );
}