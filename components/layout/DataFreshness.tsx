import { CURRENT_COMPLETED_ROUND } from "@/data/season";

/** Small note saying which round the prices and scores are current to. */
export default function DataFreshness({
  className = "mt-3",
}: {
  className?: string;
}) {
  return (
    <p className={`${className} text-xs font-medium text-slate-400`}>
      Prices as of Round {CURRENT_COMPLETED_ROUND}
    </p>
  );
}
