import { getLocale, getTranslations } from "next-intl/server";

import { formatSom } from "@/lib/currency";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/owner-context";

export const dynamic = "force-dynamic";

function formatDuration(duration: number) {
  const hours = duration / 60;
  return Number.isInteger(hours) ? `${hours} soat` : `${hours.toFixed(1)} soat`;
}

export default async function OwnerCoursesPage() {
  const t = await getTranslations("owner");
  const locale = await getLocale();
  const numberLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ";
  await getOwnerContext();
  const courses = await db.course.findMany({
    orderBy: { name: "asc" },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      _count: { select: { students: true, schedules: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
          {t("nav.courses")}
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
          {t("courses.title")}
        </h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {t("courses.description")}
        </p>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {courses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">{t("courses.name")}</th>
                  <th className="px-5 py-4 font-semibold">{t("courses.teacher")}</th>
                  <th className="px-5 py-4 font-semibold">{t("courses.duration")}</th>
                  <th className="px-5 py-4 font-semibold">{t("courses.enrollments")}</th>
                  <th className="px-5 py-4 text-right font-semibold">{t("courses.price")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {courses.map((course) => (
                  <tr key={course.id}>
                    <td className="px-5 py-4 font-semibold text-slate-950 dark:text-white">{course.name}</td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{course.teacher.user.name}</td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDuration(course.duration)}</td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{course._count.students}</td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-950 dark:text-white">{formatSom(Number(course.price), numberLocale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{t("courses.empty")}</p>
        )}
      </section>
    </div>
  );
}
