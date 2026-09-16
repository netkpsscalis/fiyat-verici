"use client";

import clsx from "clsx";
import { HandCoins, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/al", label: "Al", hint: "Müşteriden alış", icon: HandCoins },
  { href: "/ayarlar", label: "Ayarlar", hint: "Kâr payları ve kesintiler", icon: Settings },
];

export function Nav() {
  const path = usePathname();
  if (path === "/giris") return null;

  return (
    <header className="lg:border-b lg:border-line lg:bg-paper">
      <div className="mx-auto hidden max-w-6xl items-center justify-between px-8 py-3 lg:flex">
        <Link href="/al" className="font-display text-lg font-extrabold uppercase tracking-tight [font-stretch:118%]">
          Fiyat Verici
        </Link>
        <NavLinks path={path} desktop />
      </div>
      <nav
        aria-label="Ana menü"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <NavLinks path={path} />
      </nav>
    </header>
  );
}

function NavLinks({ path, desktop }: { path: string; desktop?: boolean }) {
  return (
    <ul className={clsx("flex", desktop ? "gap-1" : "h-16 justify-around")}>
      {ITEMS.map(({ href, label, hint, icon: Icon }) => {
        const active = path.startsWith(href);
        return (
          <li key={href} className={desktop ? undefined : "flex-1"}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex items-center gap-2 rounded-md text-sm font-medium transition-colors",
                desktop ? "px-3 py-2" : "h-full flex-col justify-center gap-0.5 text-xs",
                active ? "text-ink" : "text-muted hover:text-ink",
                desktop && active && "bg-ground",
              )}
            >
              <Icon aria-hidden size={desktop ? 18 : 22} strokeWidth={active ? 2.4 : 1.8} />
              <span>{label}</span>
              {desktop && <span className="sr-only">{hint}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
