"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { label: "Nano Banana", href: "/" },
  { label: "Chat", href: "/chat" },
  { label: "Math", href: "/math" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-2 px-4 py-4">
        <nav className="flex items-center gap-2">
          {links.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full border px-5 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  isActive
                    ? "border-white bg-white text-slate-900 shadow-lg shadow-black/30"
                    : "border-white/30 bg-white/10 text-white hover:border-white/50 hover:bg-white/20"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
