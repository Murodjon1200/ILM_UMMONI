import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { db } from "@/lib/db";
import {
  formatReadableDate,
  formatScheduleTime,
  getDayOfWeekInTashkent,
} from "@/lib/date";
import { getTeacherContext } from "@/lib/teacher-context";

export default async function TeacherPage() {
  const t = await getTranslations("teacher");
  const days = await getTranslations("days");
  const { session, teacher } = await getTeacherContext();
  const today = new Date();
  const todayDay = getDayOfWeekInTashkent(today);

  const [courses, students, schedules] = await Promise.all([
    db.course.findMany({
      where: { teacherId: teacher.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.student.findMany({
      where: { course: { teacherId: teacher.id } },
      select: { userId: true },
    }),
    db.schedule.findMany({
      where: { teacherId: teacher.id },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      include: { course: { select: { name: true } } },
    }),
  ]);

  const uniqueStudents = new Set(students.map((student) => student.userId)).size;
  const todaySchedule = schedules.filter(
    (schedule) => schedule.dayOfWeek === todayDay,
  );
  const upcomingClasses = schedules.filter(
    (schedule) => schedule.dayOfWeek >= todayDay,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
            {t("overview.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {t("overview.welcome")}, {session.user.name}
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {formatReadableDate(today)} · {days(String(todayDay))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/teacher/attendance"
            className="rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-800 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
          >
            {t("attendance.title")}
          </Link>
          <Link
            href="/teacher/grades"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t("grades.title")}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [t("students.title"), uniqueStudents, t("students.description"), "bg-cyan-500"],
          [t("overview.myCourses"), courses.length, t("overview.description"), "bg-brand-500"],
          [t("overview.today"), todaySchedule.length, t("overview.upcoming"), "bg-violet-500"],
          [t("overview.thisWeek"), schedules.length, t("overview.empty"), "bg-amber-500"],
        ].map(([label, value, detail, color]) => (
          <section
            key={label}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${color}`} />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">{value}</p>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
          </section>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-950 dark:text-white">{t("overview.today")}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("overview.description")} {days(String(todayDay))}.
              </p>
            </div>
            <Link href="/teacher/schedule" className="text-sm font-semibold text-cyan-700 hover:underline dark:text-cyan-400">
              {t("schedule.title")}
            </Link>
          </div>
          <div className="mt-6 space-y-3">
            {todaySchedule.length > 0 ? (
              todaySchedule.map((schedule) => (
                <div key={schedule.id} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="min-w-20 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                    {formatScheduleTime(schedule.startTime)}
                    <span className="mt-1 block text-[11px] font-normal text-slate-400">{formatScheduleTime(schedule.endTime)}</span>
                  </div>
                  <div className="h-10 w-1 rounded-full bg-cyan-400" />
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-white">{schedule.course.name}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("schedule.room")} {schedule.room}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {t("schedule.noClasses")}
              </p>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-6 dark:border-slate-800">
            <div>
              <h3 className="font-semibold text-slate-950 dark:text-white">{t("overview.upcoming")}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your next classes, in order.</p>
            </div>
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{upcomingClasses.length} classes</span>
          </div>
          {upcomingClasses.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingClasses.map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-24 text-xs font-semibold text-slate-500 dark:text-slate-400">{days(String(schedule.dayOfWeek))}</div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">{schedule.course.name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatScheduleTime(schedule.startTime)} - {formatScheduleTime(schedule.endTime)} · {t("schedule.room")} {schedule.room}</p>
                    </div>
                  </div>
                  <span className="hidden rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 sm:inline-flex">Class</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">                {t("overview.empty")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
