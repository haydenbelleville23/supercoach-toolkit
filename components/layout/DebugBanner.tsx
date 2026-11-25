import { DEBUG_AS_OF_ROUND } from "@/lib/asOf/debugAsOfRound";

/** Shown on every page while DEBUG_AS_OF_ROUND is set; nothing otherwise. */
export default function DebugBanner() {
  if (DEBUG_AS_OF_ROUND === null) {
    return null;
  }

  return (
    <div
      role="status"
      className="bg-amber-400 px-4 py-1.5 text-center text-sm font-semibold text-slate-950"
    >
      Debug: viewing as of Round {DEBUG_AS_OF_ROUND}
    </div>
  );
}
