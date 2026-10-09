import type { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { db } from "@/lib/db";
import { getTeacherContext } from "@/lib/teacher-context";

interface TeacherStudentsPageProps {
  searchParams: {
    search?: string | string[];
  };
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TeacherStudentsPage({
  searchParams,
}: TeacherStudentsPageProps) {
  const t = await getTranslations("teacher");
  const common = await getTranslations("common");
  const { teacher } = await getTeacherContext();
  const search = getParam(searchParams.search)?.trim() ?? "";
  const where: Prisma.StudentWhereInput = {
    course: { teacherId: teacher.id },
    ...(search
      ? {
          OR: [
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { course: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const students = await db.student.findMany({
    where,
    orderBy: { user: { name: "asc" } },
    include: {
      user: { select: { name: true, email: true } },
      course: { select: { name: true } },
      attendance: {
        select: {
          status: true,
          schedule: { select: { courseId: true } },
        },
      },
      grades: {
        select: { score: true, courseId: true },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">            {t("nav.students")}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">            {t("students.title")}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">            {t("students.description")}</p>
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">            {students.length} {t("students.enrollments")}</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-slate-950 dark:text-white">{t("students.progress")}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("students.description")}</p>
          </div>
          <form method="get" className="flex w-full gap-2 sm:w-80">
            <input name="search" defaultValue={search}               placeholder={t("students.search")} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            <button type="submit" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{common("search")}</button>
          </form>
        </div>
        {students.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">{common("student")}</th>
                  <th className="px-5 py-4 font-semibold">{common("course")}</th>
                  <th className="px-5 py-4 font-semibold">{t("students.attendance")}</th>
                  <th className="px-5 py-4 font-semibold">{t("students.average")}</th>
                  <th className="px-5 py-4 text-right font-semibold">{t("overview.progress")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((student) => {
                  const courseAttendance = student.attendance.filter((record) => record.schedule.courseId === student.courseId);
                  const attended = courseAttendance.filter((record) => record.status === "PRESENT" || record.status === "LATE").length;
                  const attendancePercent = courseAttendance.length > 0 ? Math.round((attended / courseAttendance.length) * 100) : null;
                  const courseGrades = student.grades.filter((grade) => grade.courseId === student.courseId);
                  const gradeAverage = courseGrades.length > 0 ? courseGrades.reduce((total, grade) => total + Number(grade.score), 0) / courseGrades.length : null;

                  return (
                    <tr key={student.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-5 py-4">
                        <Link href={`/teacher/students?search=${encodeURIComponent(student.user.name)}`} className="font-semibold text-slate-950 hover:text-cyan-700 dark:text-white dark:hover:text-cyan-400">{student.user.name}</Link>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{student.user.email}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{student.course.name}</td>
                      <td className="px-5 py-4">
                        {attendancePercent === null ? <span className="text-slate-400">{t("students.noRecords")}</span> : <span className="font-semibold text-slate-900 dark:text-white">{attendancePercent}%</span>}
                      </td>
                      <td className="px-5 py-4">
                        {gradeAverage === null ? <span className="text-slate-400">{t("students.noRecords")}</span> : <span className="font-semibold text-slate-900 dark:text-white">{gradeAverage.toFixed(1)} / 100</span>}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="ml-auto h-2 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full bg-cyan-500" style={{ width: `${attendancePercent ?? 0}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{t("students.empty")}</div>
        )}
      </section>
    </div>
  );
}
