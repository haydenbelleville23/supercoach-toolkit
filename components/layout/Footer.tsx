import Image from "next/image";
import Link from "next/link";

import { AVAILABILITY_SOURCE_LABEL } from "@/lib/availability/config";
import { BRAND, SITE_NAME } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-800 bg-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center gap-4">
          <Image
            src={BRAND.iconSquare512}
            alt=""
            width={56}
            height={56}
            sizes="56px"
            className="h-14 w-14 rounded-xl"
          />

          <div>
            <p className="text-lg font-bold text-white">{SITE_NAME}</p>
            <p className="mt-1 max-w-md text-slate-400">
              Independent AFL SuperCoach tools: price projections, cash cows and
              trade planning.
            </p>
          </div>
        </Link>

        <div className="text-left text-slate-400 md:text-right">
          <p>© {new Date().getFullYear()} {SITE_NAME}</p>
          <p className="mt-1">
            Prices and scores from SuperCoach&apos;s public site. Live scores from DFS Australia.
          </p>
          {AVAILABILITY_SOURCE_LABEL && (
            <p className="mt-1">Injury information: {AVAILABILITY_SOURCE_LABEL}</p>
          )}
          <p className="mt-1">
            Not affiliated with the AFL or the official AFL SuperCoach competition.
          </p>
          <p className="mt-3">
            <Link href="/which-ruck" className="text-brand-green hover:text-white">
              Which ruck are you?
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
