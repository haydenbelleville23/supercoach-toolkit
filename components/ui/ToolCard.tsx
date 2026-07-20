import Link from "next/link";
import { LucideIcon } from "lucide-react";

type ToolCardProps = {
  title: string;
  description: string;
  href: string;
  status: string;
  icon: LucideIcon;
};

export default function ToolCard({
  title,
  description,
  href,
  status,
  icon: Icon,
}: ToolCardProps) {
  const isAvailable = status === "Available";

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition duration-200 hover:-translate-y-1 hover:border-violet-500 hover:bg-violet-500/5 hover:shadow-xl hover:shadow-violet-900/20">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          {title}
        </h2>

        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            isAvailable
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-amber-500/15 text-amber-400"
          }`}
        >
          {status}
        </span>
      </div>

      <p className="mt-5 min-h-[72px] text-sm leading-7 text-slate-400">{description}
      </p>

      {href !== "#" && (
        <Link
          href={href}
          className="mt-6 inline-flex items-center gap-2 font-semibold text-violet-400 transition hover:gap-3 hover:text-violet-300"
        >
          Open tool →
        </Link>
      )}
    </article>
  );
}