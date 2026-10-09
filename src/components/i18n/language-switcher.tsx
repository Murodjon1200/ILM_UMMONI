"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

const localeOptions: Array<{ flag: string; label: string; value: Locale }> = [
  { flag: "UZ", label: "Oʻzbek", value: "uz" },
  { flag: "RU", label: "Русский", value: "ru" },
  { flag: "EN", label: "English", value: "en" },
];

function getCleanPathname(pathname: string) {
  const [, firstSegment, ...rest] = pathname.split("/");
  if (isLocale(firstSegment)) {
    return `/${rest.join("/")}`.replace(/\/$/, "") || "/";
  }
  return pathname;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const pathLocale = pathname.split("/")[1];
    const savedLocale = window.localStorage.getItem("ilm-ummoni-locale");
    if (isLocale(pathLocale)) {
      setLocale(pathLocale);
    } else if (savedLocale && isLocale(savedLocale)) {
      setLocale(savedLocale);
    }
  }, [pathname]);

  function changeLocale(nextLocale: Locale) {
    window.localStorage.setItem("ilm-ummoni-locale", nextLocale);
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    setLocale(nextLocale);
    router.push(`/${nextLocale}${getCleanPathname(pathname)}`);
    router.refresh();
  }

  return (
    <div className={`flex items-center gap-1 ${compact ? "rounded-full border border-white/10 bg-white/5 p-1" : ""}`} aria-label="Language">
      {localeOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => changeLocale(option.value)}
          aria-label={option.label}
          aria-pressed={locale === option.value}
          title={option.label}
          className={`inline-flex h-9 min-w-11 items-center justify-center rounded-full px-2 text-sm font-semibold transition ${
            locale === option.value
              ? "bg-brand-400 text-slate-950 shadow-sm"
              : "bg-transparent text-slate-400 hover:bg-white/10 hover:text-white"
          }`}
        >
          <span aria-hidden="true">{option.flag}</span>
        </button>
      ))}
    </div>
  );
}
