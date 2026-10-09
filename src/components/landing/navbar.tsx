"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";

const navigationLinks = [
  { href: "#home", key: "home" },
  { href: "#courses", key: "courses" },
  { href: "#teachers", key: "teachers" },
  { href: "#contact", key: "contact" },
] as const;

export function Navbar() {
  const t = useTranslations("nav");
  const common = useTranslations("common");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#060b0a]/85 backdrop-blur-xl">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link
          href="#home"
          aria-label="Ilm Ummoni"
          className="flex items-center"
          onClick={() => setIsOpen(false)}
        >
          <Image
            alt="Ilm Ummoni"
            height={40}
            priority
            src="/logo.png"
            width={95}
          />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navigationLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-300 transition hover:text-brand-400"
            >
              {t(link.key)}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher compact />
          <Link
            href="/login"
            className="hidden rounded-full bg-brand-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-brand-300 sm:inline-flex"
          >
            {common("signIn")}
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
            aria-label={isOpen ? "Menyuni yopish" : "Menyuni ochish"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10 md:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
              aria-hidden="true"
            >
              {isOpen ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {isOpen ? (
        <div
          id="mobile-navigation"
          className="border-t border-white/10 bg-[#060b0a] px-6 py-5 shadow-2xl md:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {navigationLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/5 hover:text-brand-400"
              >
                {t(link.key)}
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="mt-3 rounded-xl bg-brand-400 px-4 py-3 text-center text-sm font-bold text-slate-950"
            >
              Kirish
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
