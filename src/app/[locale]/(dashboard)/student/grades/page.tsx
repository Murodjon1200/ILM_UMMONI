import { getTranslations } from "next-intl/server";

import { formatReadableDate } from "@/lib/date";
import { db } from "@/lib/db";
import { getStudentContext } from "@/lib/student-context";

export default async function StudentGradesPage() {
  const t = await getTranslations("student");
  const { enrollments } = await getStudentContext();
  const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
  const grades = await db.grade.findMany({
    where: { studentId: { in: enrollmentIds } },
    orderBy: { date: "desc" },
    include: {
      course: {
        select: {
          name: true,
          teacher: { select: { user: { select: { name: true } } } },
        },
      },
    },
  });
  const courseIds = Array.from(new Set(grades.map((grade) => grade.courseId)));
  const overallAverage = grades.length
    ? grades.reduce((total, grade) => total + Number(grade.score), 0) / grades.length
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700 dark:text-violet-400">            {t("nav.grades")}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">            {t("grades.title")}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">            {t("grades.description")}</p>
        </div>
        <div className="rounded-xl border border-violet-100 bg-violet-50 px-5 py-3 text-right dark:border-violet-900/50 dark:bg-violet-950/40"><p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">{t("grades.average")}</p><p className="mt-1 text-2xl font-bold text-violet-700 dark:text-violet-300">{overallAverage === null ? "—" : `${overallAverage.toFixed(1)} / 100`}</p></div>
      </div>

      {grades.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900"><p className="font-semibold text-slate-950 dark:text-white">{t("overview.noGrades")}</p><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t("grades.empty")}</p></div>
      ) : (
        <div className="space-y-6">
          {courseIds.map((courseId) => {
            const courseGrades = grades.filter((grade) => grade.courseId === courseId);
            const average = courseGrades.reduce((total, grade) => total + Number(grade.score), 0) / courseGrades.length;
            const course = courseGrades[0].course;

            return (
              <section key={courseId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-6 dark:border-slate-800 sm:flex-row sm:items-center"><div><h3 className="font-semibold text-slate-950 dark:text-white">{course.name}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{course.teacher.user.name} · {courseGrades.length} assessments</p></div><span className="text-2xl font-bold text-violet-600 dark:text-violet-400">{average.toFixed(1)} <span className="text-sm font-medium text-slate-400">/ 100</span></span></div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {courseGrades.map((grade) => (
                    <article key={grade.id} className="grid gap-4 p-6 md:grid-cols-[160px_1fr_auto] md:items-center"><div><p className="text-sm font-semibold text-slate-950 dark:text-white">{formatReadableDate(grade.date)}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Assessment score</p></div><div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950/50"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("grades.teacherComment")}</p><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{grade.comment ?? t("grades.noComment")}</p></div><span className="text-3xl font-bold text-slate-950 dark:text-white">{Number(grade.score).toFixed(1)}</span></article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
