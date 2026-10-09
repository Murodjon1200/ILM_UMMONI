import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Ilm Ummoni account",
};

const accountFeatureKeys = ["features.0", "features.1", "features.2"] as const;

export default async function LoginPage() {
  const session = await auth();
  const t = await getTranslations("login");

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <div className="grid min-h-screen lg:grid-cols-2">
        <aside className="relative hidden overflow-hidden bg-slate-950 px-12 py-10 text-white lg:flex lg:flex-col">
          <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <Link
            href="/"
            className="relative z-10 text-sm font-bold tracking-[0.3em] text-brand-400"
          >
            ILM UMMONI
          </Link>
          <div className="relative z-10 my-auto max-w-xl py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-400">
              {t("title")}
            </p>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.08] tracking-tight">
              {t("heading")}
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
              {t("subtext")}
            </p>
            <div className="mt-10 grid gap-3">
              {accountFeatureKeys.map((feature, index) => (
                <div
                  key={feature}
                  className="flex items-center gap-4 border-t border-white/10 pt-3 text-sm text-slate-300"
                >
                  <span className="text-brand-400">0{index + 1}</span>
                  <span>{t(feature)}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="relative z-10 text-xs uppercase tracking-[0.25em] text-slate-500">
            {t("features.2")}
          </p>
        </aside>

        <section className="flex items-center justify-center px-6 py-10 sm:px-12">
          <div className="w-full max-w-md">
            <Link
              href="/"
              className="mb-14 inline-flex items-center gap-2 text-sm font-semibold tracking-[0.2em] text-brand-700 dark:text-brand-400 lg:hidden"
            >
              ILM UMMONI
            </Link>
            <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">
              {t("welcome")}
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t("heading")}
            </h2>
            <p className="mt-4 leading-7 text-slate-500 dark:text-slate-400">
              {t("subtext")}
            </p>
            <div className="mt-8">
              <LoginForm />
            </div>
            <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {t("help")}{" "}
              <Link
                href="/#contact"
                className="font-semibold text-brand-700 hover:underline dark:text-brand-400"
              >
                {t("contact")}
              </Link>
            </p>
            <div className="mt-8 flex justify-center">
              <LanguageSwitcher />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
