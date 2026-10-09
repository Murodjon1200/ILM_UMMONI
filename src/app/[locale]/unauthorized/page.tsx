import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function UnauthorizedPage() {
  const t = await getTranslations("errors");

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 dark:bg-slate-950">
      <section className="max-w-lg rounded-2xl bg-white p-10 text-center shadow-xl shadow-slate-200/60 dark:bg-slate-900 dark:shadow-black/30">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-600">
          {t("unauthorized")}
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">
          {t("unauthorizedDescription")}
        </h1>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white dark:bg-brand-400 dark:text-slate-950"
        >
          {t("backHome")}
        </Link>
      </section>
    </main>
  );
}
