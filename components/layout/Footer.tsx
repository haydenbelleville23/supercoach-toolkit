import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-800 bg-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center gap-4">
          <Image
            src="/images/branding/fantasy-king-logo-full.png"
            alt="Fantasy King"
            width={64}
            height={64}
            className="h-14 w-14 rounded-full object-cover"
          />

          <div>
            <p className="text-lg font-bold text-white">Fantasy King</p>
            <p className="mt-1 max-w-md text-slate-400">
              Independent AFL Fantasy tools designed to help you make better
              decisions throughout the season.
            </p>
          </div>
        </Link>

        <div className="text-left text-slate-400 md:text-right">
          <p>© {new Date().getFullYear()} Fantasy King</p>
          <p className="mt-1">
            Not affiliated with the AFL or the official AFL Fantasy or AFL SuperCoach competitions.
          </p>
        </div>
      </div>
    </footer>
  );
}