import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { formatScheduleTime } from "@/lib/date";
import { getTeacherContext } from "@/lib/teacher-context";

const weekDays = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

export default async function TeacherSchedulePage() {
  const t = await getTranslations("teacher");
  const days = await getTranslations("days");
  const { teacher } = await getTeacherContext();
  const schedules = await db.schedule.findMany({
    where: { teacherId: teacher.id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    include: { course: { select: { name: true } } },
  });
  const scheduleByDay = weekDays.map((day) => ({
    ...day,
    sessions: schedules.filter((schedule) => schedule.dayOfWeek === day.value),
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">            {t("nav.schedule")}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">            {t("schedule.title")}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">            {t("schedule.description")}</p>
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{schedules.length} {t("schedule.classes")}</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <div className="grid min-w-[1120px] grid-cols-7 divide-x divide-slate-200 dark:divide-slate-800">
            {scheduleByDay.map((day) => (
              <div key={day.value} className="min-h-[480px]">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">{days(String(day.value))}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{day.sessions.length} {t("schedule.classes")}</p>
                </div>
                <div className="space-y-3 p-3">
                  {day.sessions.map((session) => (
                    <article key={session.id} className="rounded-xl border border-cyan-100 bg-cyan-50/70 p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-cyan-900/50 dark:bg-cyan-950/30">
                      <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">{formatScheduleTime(session.startTime)} - {formatScheduleTime(session.endTime)}</p>
                      <h3 className="mt-3 text-sm font-bold leading-5 text-slate-950 dark:text-white">{session.course.name}</h3>
                      <p className="mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">{t("schedule.room")} {session.room}</p>
                    </article>
                  ))}
                  {day.sessions.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-xs leading-5 text-slate-400 dark:border-slate-800">{t("schedule.noClasses")}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
