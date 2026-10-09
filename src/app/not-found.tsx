import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function NotFoundPage() {
  const t = await getTranslations("errors");

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 dark:bg-slate-950">
      <section className="max-w-lg rounded-2xl bg-white p-10 text-center shadow-xl shadow-slate-200/60 dark:bg-slate-900 dark:shadow-black/30">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700 dark:text-brand-400">
          404
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">
          {t("notFound")}
        </h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          {t("notFoundDescription")}
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white dark:bg-brand-400 dark:text-slate-950"
        >
          {t("backHome")}
        </Link>
      </section>
    </main>
  );
}
