import Link from "next/link";

type ToolCardProps = {
  title: string;
  description: string;
  href: string;
  status: string;
};

export default function ToolCard({
  title,
  description,
  href,
  status,
}: ToolCardProps) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-semibold">{title}</h2>

        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
          {status}
        </span>
      </div>

      <p className="mt-4 leading-7 text-slate-400">{description}</p>

      {href !== "#" && (
        <Link
          href={href}
          className="mt-6 inline-block font-semibold text-emerald-400 hover:text-emerald-300"
        >
          Open tool →
        </Link>
      )}
    </article>
  );
}