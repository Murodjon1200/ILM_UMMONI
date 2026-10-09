import { getTranslations } from "next-intl/server";

import { formatScheduleTime } from "@/lib/date";
import { db } from "@/lib/db";
import { getStudentContext } from "@/lib/student-context";

const weekDays = [1, 2, 3, 4, 5, 6, 7];

export default async function StudentSchedulePage() {
  const t = await getTranslations("student");
  const days = await getTranslations("days");
  const { enrollments } = await getStudentContext();
  const courseIds = enrollments.map((enrollment) => enrollment.courseId);
  const schedules = await db.schedule.findMany({
    where: { courseId: { in: courseIds } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    include: {
      course: { select: { name: true } },
      teacher: { include: { user: { select: { name: true } } } },
    },
  });
  const scheduleByDay = weekDays.map((day) => ({
    value: day,
    sessions: schedules.filter((schedule) => schedule.dayOfWeek === day),
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
            {t("nav.schedule")}
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {t("schedule.title")}
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {t("schedule.description")}
          </p>
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {schedules.length} {t("schedule.classes")}
        </p>
      </div>

      {enrollments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="font-semibold text-slate-950 dark:text-white">
            {t("schedule.noEnrollment")}
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t("schedule.description")}
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <div className="grid min-w-[1120px] grid-cols-7 divide-x divide-slate-200 dark:divide-slate-800">
              {scheduleByDay.map((day) => (
                <div key={day.value} className="min-h-[460px]">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">
                      {days(String(day.value))}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {day.sessions.length} {t("schedule.classes")}
                    </p>
                  </div>
                  <div className="space-y-3 p-3">
                    {day.sessions.map((session) => (
                      <article key={session.id} className="rounded-xl border border-brand-100 bg-brand-50/70 p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-brand-900/50 dark:bg-brand-950/30">
                        <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                          {formatScheduleTime(session.startTime)} - {formatScheduleTime(session.endTime)}
                        </p>
                        <h3 className="mt-3 text-sm font-bold leading-5 text-slate-950 dark:text-white">
                          {session.course.name}
                        </h3>
                        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {session.teacher.user.name}
                        </p>
                        <p className="mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                          {t("schedule.room")} {session.room}
                        </p>
                      </article>
                    ))}
                    {day.sessions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-xs leading-5 text-slate-400 dark:border-slate-800">
                        {t("schedule.noClasses")}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
