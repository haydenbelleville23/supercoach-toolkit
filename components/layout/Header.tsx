import Image from "next/image";
import Link from "next/link";

import MobileMenu from "@/components/layout/MobileMenu";
import { BRAND, SITE_NAME } from "@/lib/site";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/projector", label: "Price Projector" },
  { href: "/cash-cows", label: "Cash Cows" },
  { href: "/my-team", label: "My Team" },
  { href: "/trade-planner", label: "Trade Planner" },
  { href: "/live", label: "Live Scores" },
];

export default function Header() {
  return (
    // The logo is on the same navy as the header, so its edges disappear.
    // Its height (border included) is --site-header-h in globals.css.
    <header className="sticky top-0 z-50 h-[var(--site-header-h)] border-b border-slate-800 bg-brand-navy">
      <div className="relative mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          aria-label={`${SITE_NAME} home`}
          className="flex items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
        >
          <Image
            src={BRAND.logoWideDark}
            alt={SITE_NAME}
            width={BRAND.logoWideDarkSize.width}
            height={BRAND.logoWideDarkSize.height}
            sizes="(min-width: 768px) 218px, 200px"
            priority
            // The logo has wide built-in margins: object-cover crops the
            // empty top and bottom so the wordmark is legible in a slim bar.
            className="h-11 w-[200px] object-cover object-[50%_41%] motion-safe:transition hover:opacity-90 md:h-12 md:w-[218px]"
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
