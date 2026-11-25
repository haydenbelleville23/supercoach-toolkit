import Image from "next/image";
import Link from "next/link";

import MobileMenu from "@/components/layout/MobileMenu";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/projector", label: "Price Projector" },
  { href: "/cash-cows", label: "Cash Cows" },
  { href: "/live", label: "Live Scores" },
];

export default function Header() {
  return (
  <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
    <div className="relative mx-auto flex h-24 max-w-7xl items-center justify-between px-6">
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
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            className="transition hover:text-white"
            href={link.href}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <MobileMenu links={NAV_LINKS} />
    </div>
  </header>
);
}
