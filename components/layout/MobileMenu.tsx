"use client";

import Link from "next/link";
import { useState } from "react";

type MobileMenuProps = {
  links: { href: string; label: string }[];
};

/** Menu button and drop-down for the header below the md breakpoint. */
export default function MobileMenu({ links }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 text-slate-200 transition hover:border-slate-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Main"
          className="absolute inset-x-0 top-full border-b border-slate-800 bg-slate-950 px-6 py-2 shadow-xl shadow-black/40"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block border-b border-slate-800/70 py-3.5 text-base text-slate-200 transition last:border-0 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
