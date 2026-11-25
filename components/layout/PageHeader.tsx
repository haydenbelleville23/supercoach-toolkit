import DataFreshness from "@/components/layout/DataFreshness";

type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  /** Show the "Prices as of Round N" note. */
  showFreshness?: boolean;
};

/** Eyebrow, title, description and data freshness used at the top of each tool page. */
export default function PageHeader({
  title,
  description,
  eyebrow = "2026 season",
  showFreshness = true,
}: PageHeaderProps) {
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
