import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { formatReadableDate, getTodayDateInput } from "@/lib/date";
import { getTeacherContext } from "@/lib/teacher-context";

import { saveGrades } from "../actions";

interface TeacherGradesPageProps {
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

export default async function TeacherGradesPage({
  searchParams,
}: TeacherGradesPageProps) {
  const t = await getTranslations("teacher");
  const { teacher } = await getTeacherContext();
  const courses = await db.course.findMany({
    where: { teacherId: teacher.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const requestedCourseId = getParam(searchParams.courseId);
  const selectedCourse = courses.find((course) => course.id === requestedCourseId) ?? courses[0] ?? null;
  const today = getTodayDateInput();
  const requestedDate = getParam(searchParams.date);
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate <= today ? requestedDate : today;
  const [students, grades] = selectedCourse
    ? await Promise.all([
        db.student.findMany({
          where: { courseId: selectedCourse.id },
          orderBy: { user: { name: "asc" } },
          select: { id: true, user: { select: { name: true } } },
        }),
        db.grade.findMany({
          where: { courseId: selectedCourse.id },
          orderBy: { date: "desc" },
          select: { id: true, studentId: true, score: true, comment: true },
        }),
      ])
    : [[], []];
  const latestGradeByStudent = new Map<string, (typeof grades)[number]>();
  for (const grade of grades) {
    if (!latestGradeByStudent.has(grade.studentId)) {
      latestGradeByStudent.set(grade.studentId, grade);
    }
  }
  const success = getParam(searchParams.success);
  const error = getParam(searchParams.error);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700 dark:text-violet-400">            {t("nav.grades")}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {t("grades.title")}
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {t("grades.description")}
          </p>
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{formatReadableDate(date)}</p>
      </div>

      {success ? <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300">{success}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-semibold text-slate-950 dark:text-white">{t("grades.choose")}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("grades.existing")}</p>
        {courses.length > 0 ? (
          <form method="get" className="mt-5 grid gap-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("attendance.course")}<select name="courseId" defaultValue={selectedCourse?.id ?? ""} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("attendance.date")}<input name="date" type="date" defaultValue={date} max={today} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
            <button type="submit" className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 dark:bg-violet-400 dark:text-slate-950 dark:hover:bg-violet-300">{t("grades.save")}</button>
          </form>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">{t("grades.empty")}</p>
        )}
      </section>

      {selectedCourse && students.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center">
            <div><h3 className="font-semibold text-slate-950 dark:text-white">{selectedCourse.name}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("grades.description")}</p></div>
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">{students.length} students</span>
          </div>
          <form action={saveGrades}>
            <input type="hidden" name="courseId" value={selectedCourse.id} />
            <input type="hidden" name="date" value={date} />
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {students.map((student) => {
                const grade = latestGradeByStudent.get(student.id);
                return (
                  <div key={student.id} className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_150px_1fr] md:items-center">
                    <div><p className="font-semibold text-slate-950 dark:text-white">{student.user.name}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{grade ? `${t("grades.lastScore")}: ${Number(grade.score).toFixed(1)}` : t("grades.noGrade")}</p></div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("grades.score")}<input type="number" name={`score:${student.id}`} min="0" max="100" step="0.01" defaultValue={grade ? Number(grade.score) : ""} required className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("grades.comment")}<input type="text" name={`comment:${student.id}`} defaultValue={grade?.comment ?? ""} maxLength={500} placeholder={t("grades.optional")} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                    {grade ? <input type="hidden" name={`gradeId:${student.id}`} value={grade.id} /> : null}
                  </div>
                );
              })}
            </div>
            <div className="border-t border-slate-200 p-5 dark:border-slate-800"><button type="submit" className="rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 dark:bg-violet-400 dark:text-slate-950 dark:hover:bg-violet-300">{t("grades.save")}</button></div>
          </form>
        </section>
      ) : selectedCourse ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">{t("grades.noStudents")}</div>
      ) : null}
    </div>
  );
}
