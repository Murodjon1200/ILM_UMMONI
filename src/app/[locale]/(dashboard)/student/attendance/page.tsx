import type { AttendanceStatus } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { formatReadableDate } from "@/lib/date";
import { db } from "@/lib/db";
import { getStudentContext } from "@/lib/student-context";

const statusStyles: Record<AttendanceStatus, string> = {
  PRESENT: "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300",
  ABSENT: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  LATE: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  EXCUSED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export default async function StudentAttendancePage() {
  const t = await getTranslations("student");
  const common = await getTranslations("common");
  const statusT = await getTranslations("status");
  const { enrollments } = await getStudentContext();
  const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
  const attendance = await db.attendance.findMany({
    where: { studentId: { in: enrollmentIds } },
    orderBy: { date: "desc" },
    include: {
      schedule: {
        select: {
          course: { select: { name: true } },
        },
      },
    },
  });
  const attended = attendance.filter((record) => record.status === "PRESENT" || record.status === "LATE").length;
  const overallPercentage = attendance.length ? Math.round((attended / attendance.length) * 100) : null;
  const courseIds = Array.from(new Set(attendance.map((record) => record.schedule.course.name)));

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-400">            {t("nav.attendance")}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">            {t("attendance.title")}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">            {t("attendance.description")}</p>
        </div>
        <div className="rounded-xl border border-brand-100 bg-brand-50 px-5 py-3 text-right dark:border-brand-900/50 dark:bg-brand-950/40"><p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">{t("attendance.rate")}</p><p className="mt-1 text-2xl font-bold text-brand-700 dark:text-brand-300">{overallPercentage === null ? "—" : `${overallPercentage}%`}</p></div>
      </div>

      {attendance.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900"><p className="font-semibold text-slate-950 dark:text-white">{t("attendance.empty")}</p><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t("attendance.description")}</p></div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-6 dark:border-slate-800"><h3 className="font-semibold text-slate-950 dark:text-white">{t("attendance.history")}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{attendance.length} · {courseIds.length} {t("schedule.classes")}</p></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950/40 dark:text-slate-400"><tr><th className="px-5 py-4 font-semibold">{common("date")}</th><th className="px-5 py-4 font-semibold">{common("course")}</th><th className="px-5 py-4 font-semibold">{common("status")}</th><th className="px-5 py-4 text-right font-semibold">{t("attendance.result")}</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {attendance.map((record) => (
                  <tr key={record.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50"><td className="px-5 py-4 font-medium text-slate-950 dark:text-white">{formatReadableDate(record.date)}</td><td className="px-5 py-4 text-slate-600 dark:text-slate-300">{record.schedule.course.name}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[record.status]}`}>{statusT(record.status)}</span></td><td className="px-5 py-4 text-right font-semibold text-slate-950 dark:text-white">{record.status === "PRESENT" || record.status === "LATE" ? t("attendance.attended") : t("attendance.missed")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
