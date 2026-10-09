"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SidebarNavItem {
  href: string;
  label: string;
}

const LOCALES = new Set(["uz", "ru", "en"]);

/**
 * next-intl runs with `localePrefix: "always"`, so usePathname() returns
 * "/uz/admin" while the navigation hrefs are unprefixed ("/admin"). Strip the
 * leading locale segment before comparing or nothing ever matches.
 */
function stripLocale(pathname: string) {
  const [, first, ...rest] = pathname.split("/");

  if (first && LOCALES.has(first)) {
    return `/${rest.join("/")}`;
  }

  return pathname;
}

function normalise(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function isActive(pathname: string, href: string) {
  // Every navigation target is a flat page (no nested children), so an exact
  // match is correct. Prefix matching would also light up the section index
  // ("/admin") while on a child page ("/admin/students").
  return normalise(stripLocale(pathname)) === normalise(href);
}

/**
 * Client-side so the current section can be resolved from the pathname. The
 * active item is highlighted in the brand blue; previously every link rendered
 * identically, so there was no active state to recolour.
 */
export function SidebarNav({ items }: { items: SidebarNavItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="flex flex-wrap gap-2 lg:flex-col">
      {items.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "rounded-lg border px-4 py-2 text-sm font-medium transition",
              active
                ? "border-brand-400/40 bg-brand-500/15 text-brand-300"
                : "border-transparent text-slate-300 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
