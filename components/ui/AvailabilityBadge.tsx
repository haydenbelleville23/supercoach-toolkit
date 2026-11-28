"use client";

import { Ban, Bandage, CircleHelp, Clock, type LucideIcon } from "lucide-react";

import InfoPopover from "@/components/ui/InfoPopover";
import { isStale, type RoundAvailability } from "@/lib/availability/selectors";
import type { AvailabilityStatus } from "@/lib/availability/types";

type Shown = Exclude<AvailabilityStatus, "available">;

const STYLE: Record<Shown, { icon: LucideIcon; tone: string; name: string }> = {
  "long-term": { icon: Bandage, tone: "border-red-400/60 bg-red-500/20 text-red-100", name: "Injured (long-term)" },
  suspended: { icon: Ban, tone: "border-red-400/60 bg-red-500/20 text-red-100", name: "Suspended" },
  "short-term": { icon: Bandage, tone: "border-orange-400/60 bg-orange-500/20 text-orange-100", name: "Injured (short-term)" },
  test: { icon: Clock, tone: "border-amber-400/60 bg-amber-500/20 text-amber-100", name: "Fitness test" },
  unknown: { icon: CircleHelp, tone: "border-slate-500 bg-slate-700/60 text-slate-100", name: "Status unclear" },
};

/** Short label: INJ, SUS, TEST, OUT 2w, ? ("OUT" without weeks when compact). */
export function badgeLabel(
  info: Pick<RoundAvailability, "status" | "returnWeeks">,
  compact = false,
): string {
  switch (info.status) {
    case "long-term":
      return "INJ";
    case "suspended":
      return "SUS";
    case "test":
      return "TEST";
    case "short-term":
      return info.returnWeeks && !compact ? `OUT ${info.returnWeeks}w` : "OUT";
    default:
      return "?";
  }
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The details line(s) shown on tap and in the accessible name. */
export function badgeDetails(info: RoundAvailability, stale: boolean): string[] {
  const lines = [
    [STYLE[info.status as Shown]?.name, info.injury].filter(Boolean).join(": "),
    info.returnText ? `Return: ${info.returnText}${info.returnRound ? ` (about Round ${info.returnRound})` : ""}` : null,
    info.selected === true ? `Named for Round ${info.round}` : info.selected === false ? `Not named for Round ${info.round}` : null,
    info.asOf ? `As of ${formatDate(info.asOf)}${stale ? " (out of date)" : ""}` : null,
    info.sample ? "Sample status data (invented)" : `Source: ${info.source}`,
  ];
  return lines.filter((line): line is string => !!line);
}

/**
 * A player's availability as a small text label with an icon (INJ, SUS,
 * TEST, OUT 2w, ?). Nothing for available players or when nothing is
 * known. Tap, hover or focus shows the injury, return, date and source
 * (the shared InfoPopover). Greyed when the list is more than a week old.
 */
export default function AvailabilityBadge({
  info,
  size = "sm",
  today = new Date(),
}: {
  info: RoundAvailability | null;
  /** "xs" for field cards. */
  size?: "xs" | "sm";
  today?: Date;
}) {
  if (!info || info.status === "available") return null;

  const style = STYLE[info.status];
  const stale = isStale(info, today);
  // Field cards are narrow: the weeks are in the details instead.
  const label = badgeLabel(info, size === "xs");
  const details = badgeDetails(info, stale);
  const Icon = style.icon;

  return (
    <InfoPopover
      label={`${label}: ${details.join(". ")}`}
      widthRem={14}
      triggerClassName={`inline-flex shrink-0 items-center gap-0.5 rounded border font-bold leading-none tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
        size === "xs" ? "px-0.5 py-px text-[8px]" : "px-1 py-0.5 text-[10px]"
      } ${stale ? "border-slate-600 bg-slate-800 text-slate-400" : style.tone} ${info.sample ? "border-dashed" : ""}`}
      trigger={
        <>
          <Icon aria-hidden="true" className={size === "xs" ? "h-2 w-2" : "h-3 w-3"} strokeWidth={2.5} />
          {label}
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
