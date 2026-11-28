import { DEBUG_AS_OF_ROUND } from "@/lib/asOf/debugAsOfRound";
import { DEBUG_SEASON } from "@/lib/season/seasonYear";
/** Shown on every page while DEBUG_AS_OF_ROUND or DEBUG_SEASON is set; nothing otherwise. */
export default function DebugBanner() {
  if (DEBUG_AS_OF_ROUND === null && DEBUG_SEASON === null) {
    return null;
  }

  return (
    <div
      role="status"
      className="bg-amber-400 px-4 py-1.5 text-center text-sm font-semibold text-slate-950"
    >
      {DEBUG_AS_OF_ROUND !== null
        ? `Debug: viewing as of Round ${DEBUG_AS_OF_ROUND}`
        : `Debug: viewing the ${DEBUG_SEASON} season`}
    </div>
  );
}
