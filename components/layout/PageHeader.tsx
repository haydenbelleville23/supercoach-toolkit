import DataFreshness from "@/components/layout/DataFreshness";

type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  /** Show the "Prices as of Round N" note. */
  showFreshness?: boolean;
  /**
   * One slim line: the title and freshness note, with the description
   * behind a small "?" toggle. Used where the tool should start near the top.
   */
  compact?: boolean;
};

/** Eyebrow, title, description and data freshness used at the top of each tool page. */
export default function PageHeader({
  title,
  description,
  eyebrow = "2026 season",
  showFreshness = true,
  compact = false,
}: PageHeaderProps) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>

        <details id="page-description-toggle" className="group peer">
          <summary
            aria-label="About this page"
            aria-controls="page-description"
            className="-ml-1 inline-flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full border border-slate-700 text-xs font-bold text-slate-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 group-open:border-violet-500 group-open:text-violet-300 [&::-webkit-details-marker]:hidden"
          >
            ?
          </summary>
        </details>

        {showFreshness && <DataFreshness className="ml-auto" />}

        {/* Opens on its own line under the header (pushes content down
            rather than covering it). */}
        <p
          id="page-description"
          className="hidden basis-full text-sm text-slate-300 peer-open:block"
        >
          {description}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
        {eyebrow}
      </p>

      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h1>

      <p className="mt-4 text-slate-300">{description}</p>

      {showFreshness && <DataFreshness />}
    </div>
  );
}
