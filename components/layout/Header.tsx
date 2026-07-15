import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-slate-800">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div>
          <p className="text-xl font-bold">SuperCoach Toolkit</p>
          <p className="text-sm text-slate-400">AFL SuperCoach analytics</p>
        </div>

        <nav className="hidden gap-6 text-sm text-slate-300 sm:flex">
          <Link className="hover:text-white" href="/">
            Home
          </Link>

          <Link className="hover:text-white" href="/projector">
            Price Projector
          </Link>
        </nav>
      </div>
    </header>
  );
}