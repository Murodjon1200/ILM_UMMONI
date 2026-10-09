import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import {
  formatReadableDate,
  formatScheduleTime,
  getDayOfWeekInTashkent,
  getTodayDateInput,
} from "@/lib/date";
import { getTeacherContext } from "@/lib/teacher-context";

import { saveAttendance } from "../actions";

const attendanceOptions = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
] as const;

interface TeacherAttendancePageProps {
  searchParams: {
    courseId?: string | string[];
    date?: string | string[];
    error?: string | string[];
    success?: string | string[];
  };
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TeacherAttendancePage({
  searchParams,
}: TeacherAttendancePageProps) {
  const t = await getTranslations("teacher");
  const { teacher } = await getTeacherContext();
  const courses = await db.course.findMany({
    where: { teacherId: teacher.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const requestedCourseId = getParam(searchParams.courseId);
  const selectedCourse =
    courses.find((course) => course.id === requestedCourseId) ?? courses[0] ?? null;
  const today = getTodayDateInput();
  const requestedDate = getParam(searchParams.date);
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate <= today ? requestedDate : today;
  const dayOfWeek = getDayOfWeekInTashkent(new Date(`${date}T00:00:00.000Z`));
  const schedule = selectedCourse
    ? await db.schedule.findFirst({
        where: { courseId: selectedCourse.id, dayOfWeek },
        orderBy: { startTime: "asc" },
      })
    : null;
  const [students, attendance] = selectedCourse && schedule
    ? await Promise.all([
        db.student.findMany({
          where: { courseId: selectedCourse.id },
          orderBy: { user: { name: "asc" } },
          select: { id: true, user: { select: { name: true } } },
        }),
        db.attendance.findMany({
          where: { scheduleId: schedule.id, date: new Date(`${date}T00:00:00.000Z`) },
          select: { studentId: true, status: true },
        }),
      ])
    : [[], []];
  const attendanceByStudent = new Map(attendance.map((record) => [record.studentId, record.status]));
  const success = getParam(searchParams.success);
  const error = getParam(searchParams.error);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
            {t("nav.attendance")}
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{t("attendance.title")}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">{t("attendance.description")}</p>
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{formatReadableDate(date)}</p>
      </div>

      {success ? <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300">{success}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-semibold text-slate-950 dark:text-white">{t("attendance.choose")}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Attendance can only be saved for a course with a schedule on the selected day.</p>
        {courses.length > 0 ? (
          <form method="get" className="mt-5 grid gap-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("attendance.course")}<select name="courseId" defaultValue={selectedCourse?.id ?? ""} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("attendance.date")}<input name="date" type="date" defaultValue={date} max={today} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
            <button type="submit" className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-800 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300">{t("attendance.load")}</button>
          </form>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">{t("attendance.empty")}</p>
        )}
      </section>

      {selectedCourse && schedule ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center">
            <div><h3 className="font-semibold text-slate-950 dark:text-white">{selectedCourse.name}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatScheduleTime(schedule.startTime)} - {formatScheduleTime(schedule.endTime)} · {t("schedule.room")} {schedule.room}</p></div>
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">{students.length} students</span>
          </div>
          {students.length > 0 ? (
            <form action={saveAttendance}>
              <input type="hidden" name="courseId" value={selectedCourse.id} />
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="scheduleId" value={schedule.id} />
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((student) => (
                  <div key={student.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-slate-950 dark:text-white">{student.user.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {attendanceOptions.map((option) => (
                        <label key={option.value} className="cursor-pointer">
                          <input type="radio" name={`status:${student.id}`} value={option.value} defaultChecked={attendanceByStudent.get(student.id) === option.value} required className="peer sr-only" />
                          <span className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition peer-checked:border-cyan-500 peer-checked:bg-cyan-50 peer-checked:text-cyan-700 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-500 dark:border-slate-700 dark:text-slate-400 dark:peer-checked:border-cyan-400 dark:peer-checked:bg-cyan-950/50 dark:peer-checked:text-cyan-300">{t(`attendance.${option.value.toLowerCase()}`)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 p-5 dark:border-slate-800"><button type="submit" className="rounded-lg bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-800 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300">{t("attendance.save")}</button></div>
            </form>
          ) : (
            <p className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{t("attendance.noStudents")}</p>
          )}
        </section>
      ) : selectedCourse ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{t("attendance.noSchedule")}</div>
      ) : null}
    </div>
  );
}
