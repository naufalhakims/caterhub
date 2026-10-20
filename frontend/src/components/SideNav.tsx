"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SideNav({ items }: { items: readonly (readonly [string, string, string])[] }) {
  const path = usePathname();
  return (
    <>
      {/* Mobile: horizontal scroll nav */}
      <nav className="mb-4 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
        {items.map(([href, label, mark]) => {
          const active = path === href || (href !== "/vendor/dashboard" && href !== "/admin/dashboard" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                active ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
              }`}
            >
              <span aria-hidden>{mark}</span>
              {label}
            </Link>
          );
        })}
      </nav>
      {/* Desktop: sidebar */}
      <nav className="sticky top-20 hidden space-y-1 md:block">
        {items.map(([href, label, mark]) => {
          const active = path === href || (href !== "/vendor/dashboard" && href !== "/admin/dashboard" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-600 hover:bg-white hover:shadow-soft"
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
