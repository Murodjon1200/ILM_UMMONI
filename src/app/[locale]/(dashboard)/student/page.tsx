import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { formatSom } from "@/lib/currency";
import { getCurrentMonthRange, formatReadableDate, formatScheduleTime, getDayOfWeekInTashkent } from "@/lib/date";
import { db } from "@/lib/db";
import { getStudentContext } from "@/lib/student-context";
import { GamificationPanel } from "@/components/student/gamification-panel";

export default async function StudentPage() {
  const t = await getTranslations("student");
  const days = await getTranslations("days");
  const { enrollments, session } = await getStudentContext();
  const courseIds = enrollments.map((enrollment) => enrollment.courseId);
  const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
  const today = new Date();
  const todayDay = getDayOfWeekInTashkent(today);
  const month = getCurrentMonthRange(today);

  const [schedules, allGrades, payments] = await Promise.all([
    db.schedule.findMany({
      where: { courseId: { in: courseIds } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      include: {
        course: { select: { name: true } },
        teacher: { include: { user: { select: { name: true } } } },
      },
    }),
    db.grade.findMany({
      where: { studentId: { in: enrollmentIds } },
      orderBy: { date: "desc" },
      include: { course: { select: { name: true } } },
    }),
    db.payment.findMany({
      where: { studentId: { in: enrollmentIds } },
      orderBy: { date: "desc" },
    }),
  ]);

  const grades = allGrades.slice(0, 5);
  const todaySchedule = schedules.filter((schedule) => schedule.dayOfWeek === todayDay);
  const weekSchedule = schedules.filter((schedule) => schedule.dayOfWeek >= todayDay);
  const currentMonthPayments = payments.filter(
    (payment) => payment.date >= month.start && payment.date < month.end,
  );
  const currentMonthPaid = currentMonthPayments.some((payment) => payment.status === "PAID");
  const gradeAverage = allGrades.length
    ? allGrades.reduce((total, grade) => total + Number(grade.score), 0) / allGrades.length
    : null;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-8 text-white shadow-xl shadow-slate-200/50 dark:shadow-black/20 sm:p-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-400/15 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-400">            {t("overview.eyebrow")}</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight">            {t("overview.welcome")}, {session.user.name}</h2>
            <p className="mt-3 text-slate-300">            {formatReadableDate(today)} · {days(String(todayDay))}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/student/grades" className="rounded-lg bg-brand-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-brand-300">            {t("nav.grades")}</Link>
            <Link href="/student/schedule" className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">            {t("nav.schedule")}</Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [t("overview.myCourses"), enrollments.length, t("overview.myCourses"), "bg-brand-500"],
          [t("overview.today"), todaySchedule.length, t("overview.thisWeek"), "bg-cyan-500"],
          [t("overview.gradeAverage"), gradeAverage === null ? "—" : gradeAverage.toFixed(1), t("overview.recentGrades"), "bg-violet-500"],
          [month.label, currentMonthPaid ? t("overview.paid") : t("overview.unpaid"), currentMonthPaid ? t("overview.paid") : t("overview.unpaid"), currentMonthPaid ? "bg-brand-500" : "bg-amber-500"],
        ].map(([label, value, detail, color]) => (
          <section key={String(label)} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className={`absolute inset-x-0 top-0 h-1 ${color}`} />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">{value}</p>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
          </section>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <GamificationPanel studentIds={enrollmentIds} />

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4">
            <div><h3 className="font-semibold text-slate-950 dark:text-white">{t("overview.myCourses")}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("overview.description")}</p></div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">{enrollments.length} total</span>
          </div>
          <div className="mt-6 space-y-3">
            {enrollments.length > 0 ? enrollments.map((enrollment) => (
              <div key={enrollment.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="font-semibold text-slate-950 dark:text-white">{enrollment.course.name}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{enrollment.course.teacher.user.name} · {enrollment.course.teacher.subject}</p></div>
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold capitalize text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">{enrollment.status.toLowerCase()}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">            {enrollment.course.description ?? t("overview.description")}</p>
              </div>
            )) : <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">You are not enrolled in a course yet.</p>}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-6 dark:border-slate-800"><div><h3 className="font-semibold text-slate-950 dark:text-white">{t("overview.thisWeek")}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("overview.description")}</p></div><Link href="/student/schedule" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">{t("nav.schedule")}</Link></div>
          {weekSchedule.length > 0 ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{weekSchedule.slice(0, 6).map((schedule) => <div key={schedule.id} className="flex items-center justify-between gap-4 px-6 py-4"><div className="flex items-center gap-4"><span className="w-20 text-xs font-semibold text-slate-500 dark:text-slate-400">{days(String(schedule.dayOfWeek))}</span><div><p className="text-sm font-semibold text-slate-950 dark:text-white">{schedule.course.name}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatScheduleTime(schedule.startTime)} · {schedule.teacher.user.name} · {t("schedule.room")} {schedule.room}</p></div></div></div>)}</div> : <p className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{t("overview.empty")}</p>}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-800"><h3 className="font-semibold text-slate-950 dark:text-white">{t("overview.recentGrades")}</h3><Link href="/student/grades" className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-400">{t("nav.grades")}</Link></div>
          {grades.length > 0 ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{grades.map((grade) => <div key={grade.id} className="flex items-center justify-between gap-4 px-6 py-4"><div><p className="text-sm font-semibold text-slate-950 dark:text-white">{grade.course.name}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatReadableDate(grade.date)}{grade.comment ? ` · ${grade.comment}` : ""}</p></div><span className="text-lg font-bold text-violet-600 dark:text-violet-400">{Number(grade.score).toFixed(1)}</span></div>)}</div> : <p className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{t("overview.noGrades")}</p>}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-800"><div><h3 className="font-semibold text-slate-950 dark:text-white">{t("overview.paymentStatus")}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{month.label} · {currentMonthPaid ? t("overview.paid") : t("overview.unpaid")}</p></div><Link href="/student/payments" className="text-sm font-semibold text-amber-700 hover:underline dark:text-amber-400">{t("payments.title")}</Link></div>
          <div className="p-6"><div className={`rounded-xl p-5 ${currentMonthPaid ? "bg-brand-50 dark:bg-brand-950/40" : "bg-amber-50 dark:bg-amber-950/40"}`}><p className={`text-sm font-semibold ${currentMonthPaid ? "text-brand-700 dark:text-brand-300" : "text-amber-700 dark:text-amber-300"}`}>{currentMonthPaid ? t("overview.paid") : t("overview.unpaid")}</p><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t("overview.recordedThisMonth")} {formatSom(currentMonthPayments.reduce((total, payment) => total + Number(payment.amount), 0))}</p></div></div>
        </section>
      </div>
    </div>
  );
}
