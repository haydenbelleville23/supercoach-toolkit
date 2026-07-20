import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
  <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
    <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-6">
      <Link href="/" className="flex items-center">
        <Image
          src="/images/branding/fantasy-king-logo-full.png"
          alt="Fantasy King"
          width={220}
          height={73}
          priority
          className="h-16 w-auto transition duration-200 hover:opacity-90 md:h-18"
        />
      </Link>

      <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
        <Link className="transition hover:text-white" href="/">
          Home
        </Link>

        <Link className="transition hover:text-white" href="/projector">
          Price Projector
        </Link>

        <Link className="transition hover:text-white" href="/cash-cows">
          Cash Cows
        </Link>

        <Link className="transition hover:text-white" href="/live">
          Live Scores
        </Link>
      </nav>

    </div>
  </header>
);
}