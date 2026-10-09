import { defineRouting } from "next-intl/routing";

export const locales = ["uz", "ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "uz";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export const routing = defineRouting({
  defaultLocale,
  localeCookie: true,
  localeDetection: true,
  localePrefix: "always",
  locales,
});
