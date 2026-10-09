import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { getParentContext } from "@/lib/parent-context";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("parent");
  const { parent } = await getParentContext();

  const children_ = await db.student.findMany({
    where: { parentId: parent.id },
    select: {
      id: true,
      course: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "asc" },
  });

  const courseIds = [...new Set(children_.map((child) => child.course.id))];

  const nav = [
    { href: "/parent", label: t("nav.overview") },
    { href: "/parent/weekly-report", label: t("nav.weekly") },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
              {t("brand")}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
              {t("title")}
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-600 dark:border-slate-800 dark:text-slate-300 dark:hover:border-brand-400 dark:hover:text-brand-400"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <p className="mx-auto max-w-7xl px-6 pb-4 text-sm text-slate-500 sm:px-8 dark:text-slate-400">
          {children_.length > 0
            ? `${children_.length} ${t("childrenLabel")} · ${courseIds.length} ${t("courseLabel")}`
            : t("noChildren")}
        </p>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}