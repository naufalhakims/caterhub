"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Navigasi peran: item aktif jelas ("saya di mana"), umpan balik saat ditekan. */
export function SideNav({ items }: { items: readonly (readonly [string, string, string])[] }) {
  const path = usePathname();
  const isActive = (href: string) =>
    path === href || (href !== "/vendor/dashboard" && href !== "/admin/dashboard" && path.startsWith(href));
  return (
    <>
      {/* Mobile: horizontal scroll nav */}
      <nav aria-label="Navigasi" className="-mx-4 mb-4 flex snap-x scroll-px-4 gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden">
        {items.map(([href, label, mark]) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`pressable flex shrink-0 snap-start items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ease-fluid ${
                active ? "bg-sun-400 text-ink" : "bg-white text-stone-600 ring-1 ring-inset ring-stone-300"
              }`}
            >
              <span aria-hidden>{mark}</span>
              {label}
            </Link>
          );
        })}
      </nav>
      {/* Desktop: sidebar */}
      <nav aria-label="Navigasi" className="sticky top-20 hidden space-y-1 md:block">
        {items.map(([href, label, mark]) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`pressable flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[15px] font-medium transition-colors duration-200 ease-fluid ${
                active
                  ? "bg-sun-400 text-ink"
                  : "text-stone-600 hover:bg-stone-100 hover:text-ink"
              }`}
            >
              <span aria-hidden className="w-5 text-center">{mark}</span>
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
