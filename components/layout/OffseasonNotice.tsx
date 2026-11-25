import { SEASON_YEAR } from "@/data/season";

/** Shown instead of projections when no rounds are left to play. */
export default function OffseasonNotice({
  className = "",
  showsFinalPrices = false,
}: {
  className?: string;
  /** True when the page still shows final prices below the notice. */
  showsFinalPrices?: boolean;
}) {
  return (
    <section
      role="status"
      className={`rounded-2xl border border-violet-500/30 bg-violet-500/10 px-6 py-6 ${className}`}
    >
      <h2 className="text-lg font-semibold text-white">
        The {SEASON_YEAR} season is over
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-300">
        {SEASON_YEAR + 1} projections start when the season opens.
        {showsFinalPrices &&
          ` Final ${SEASON_YEAR} prices and scores are shown below.`}
      </p>
    </section>
  );
}
