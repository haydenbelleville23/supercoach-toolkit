"use client";

import { Ambulance, Armchair, CircleDashed, Droplet, OctagonX, type LucideIcon } from "lucide-react";

import InfoPopover from "@/components/ui/InfoPopover";
import type { LiveStatus, LiveStatusInfo } from "@/lib/liveMatch/liveStatus";

type Tagged = Exclude<LiveStatus, "onGround">;

// Rounded pills with an outline and no fill, so they don't look like the
// weekly availability badges (square corners, filled).
export const LIVE_TAG: Record<Tagged, { label: string; name: string; icon: LucideIcon; tone: string }> = {
  bench: { label: "BENCH", name: "On the bench", icon: Armchair, tone: "border-sky-400/70 text-sky-200" },
  bloodRule: { label: "BLOOD", name: "Off under the blood rule", icon: Droplet, tone: "border-rose-400/70 text-rose-200" },
  injured: { label: "INJ", name: "Off injured", icon: Ambulance, tone: "border-fuchsia-400/70 text-fuchsia-200" },
  ruledOut: { label: "OUT", name: "Ruled out of the game", icon: OctagonX, tone: "border-slate-400/70 text-slate-200" },
  unknown: { label: "?", name: "Status unclear", icon: CircleDashed, tone: "border-dashed border-slate-500 text-slate-300" },
};

/** Popover lines: what it means, the feed's reason (as text), the source. */
export function liveTagDetails(info: LiveStatusInfo, sample = false): string[] {
  const tag = LIVE_TAG[info.status as Tagged];
  return [
    `${tag.name} (in-game, from the live feed)`,
    info.reason ? `Feed reason: ${info.reason}` : null,
    info.status === "unknown" ? "The live feed gave a reason but didn't mark the player on the bench." : null,
    sample ? "Sample live data (invented)" : "Source: DFS Australia live scoring",
  ].filter((line): line is string => !!line);
}

/**
 * In-game status beside a player's name on the Live page: BENCH, BLOOD,
 * INJ, OUT or ?, as text with an icon. Nothing for on-ground players or
 * when the feed doesn't say. Tap, hover or focus for details.
 */
export default function LiveStatusTag({ info, sample = false }: { info: LiveStatusInfo | null; sample?: boolean }) {
  if (!info || info.status === "onGround") return null;

  const tag = LIVE_TAG[info.status];
  const details = liveTagDetails(info, sample);
  const Icon = tag.icon;

  return (
    <InfoPopover
      label={`${tag.label}: ${details.join(". ")}`}
      widthRem={14}
      triggerClassName={`inline-flex shrink-0 items-center gap-0.5 rounded-full border bg-transparent px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${tag.tone}`}
      trigger={
        <>
          <Icon aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
          {tag.label}
        </>
      }
    >
      {details.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </InfoPopover>
  );
}
