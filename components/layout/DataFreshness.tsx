import { CURRENT_COMPLETED_ROUND, IS_PRESEASON, SEASON_YEAR } from "@/data/season";

/** Small note saying which round the prices and scores are current to. */
export default function DataFreshness({
  className = "mt-3",
}: {
  className?: string;
}) {
  return (
    <p className={`${className} text-xs font-medium text-slate-400`}>
      {IS_PRESEASON ? `${SEASON_YEAR} preseason: no rounds played yet` : `Prices as of Round ${CURRENT_COMPLETED_ROUND}`}
    </p>
  );
}
