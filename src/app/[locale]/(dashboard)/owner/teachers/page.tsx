import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/owner-context";

export const dynamic = "force-dynamic";

export default async function OwnerTeachersPage() {
  const t = await getTranslations("owner");
  await getOwnerContext();
  const teachers = await db.teacher.findMany({
    orderBy: { subject: "asc" },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      _count: { select: { courses: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
          {t("nav.teachers")}
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
          {t("teachers.title")}
        </h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {t("teachers.description")}
        </p>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {teachers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">{t("teachers.name")}</th>
                  <th className="px-5 py-4 font-semibold">{t("teachers.subject")}</th>
                  <th className="px-5 py-4 font-semibold">{t("teachers.courses")}</th>
                  <th className="px-5 py-4 font-semibold">{t("teachers.contact")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td className="px-5 py-4 font-semibold text-slate-950 dark:text-white">{teacher.user.name}</td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{teacher.subject}</td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{teacher._count.courses}</td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{teacher.user.email}<span className="mt-1 block text-xs">{teacher.user.phone}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{t("teachers.empty")}</p>
        )}
      </section>
    </div>
  );
}
