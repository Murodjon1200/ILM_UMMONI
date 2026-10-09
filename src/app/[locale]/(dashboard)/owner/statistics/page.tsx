import { getLocale, getTranslations } from "next-intl/server";

import {
  EnrollmentBarChart,
  RevenueChart,
  StudentGrowthChart,
} from "@/components/owner/charts";
import { formatSom } from "@/lib/currency";
import { db } from "@/lib/db";
import { getOwnerContext } from "@/lib/owner-context";

export const dynamic = "force-dynamic";

function getMonthKeys(count: number, referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - (count - 1 - index), 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export default async function OwnerStatisticsPage() {
  const t = await getTranslations("owner");
  const locale = await getLocale();
  const numberLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ";
  const { owner } = await getOwnerContext();
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const [students, courses, payments] = await Promise.all([
    db.user.findMany({
      where: { role: "STUDENT" },
      select: { createdAt: true },
    }),
    db.course.findMany({
      orderBy: { students: { _count: "desc" } },
      take: 10,
      include: {
        _count: { select: { students: true } },
        teacher: { include: { user: { select: { name: true } } } },
      },
    }),
    db.payment.findMany({
      where: { status: "PAID" },
      select: { amount: true, date: true },
    }),
  ]);

  const revenueMonths = getMonthKeys(12, now);
  const growthMonths = getMonthKeys(6, now);
  const revenueData = revenueMonths.map((month) => ({
    month,
    revenue: payments
      .filter((payment) => payment.date.toISOString().startsWith(month))
      .reduce((total, payment) => total + Number(payment.amount), 0),
  }));
  const studentGrowthData = growthMonths.map((month) => ({
    month,
    students: students.filter((student) =>
      student.createdAt.toISOString().startsWith(month),
    ).length,
  }));
  const annualRevenue = payments
    .filter((payment) => payment.date >= yearStart)
    .reduce((total, payment) => total + Number(payment.amount), 0);
  const averagePayment = payments.length
    ? annualRevenue / payments.length
    : 0;
  const totalEnrollments = courses.reduce(
    (total, course) => total + course._count.students,
    0,
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
          {t("statistics.title")}
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
          {owner.name}
        </h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {t("statistics.description")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [t("statistics.revenue"), formatSom(annualRevenue, numberLocale)],
          [t("statistics.students"), students.length.toLocaleString(numberLocale)],
          [t("statistics.enrollments"), totalEnrollments.toLocaleString(numberLocale)],
          [t("statistics.averageCheck"), formatSom(averagePayment, numberLocale)],
        ].map(([label, value]) => (
          <section key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</p>
          </section>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-semibold text-slate-950 dark:text-white">{t("overview.revenueChart")}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("statistics.byMonth")}</p>
        <div className="mt-5"><RevenueChart data={revenueData} locale={numberLocale} /></div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-950 dark:text-white">{t("statistics.byCourse")}</h3>
          <div className="mt-5"><EnrollmentBarChart data={courses.slice(0, 6).map((course) => ({ name: course.name, students: course._count.students }))} /></div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-950 dark:text-white">{t("overview.studentGrowth")}</h3>
          <div className="mt-5"><StudentGrowthChart data={studentGrowthData} locale={numberLocale} /></div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-semibold text-slate-950 dark:text-white">{t("overview.topCourses")}</h3>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950/40 dark:text-slate-400"><tr><th className="px-4 py-3 font-semibold">{t("courses.name")}</th><th className="px-4 py-3 font-semibold">{t("courses.teacher")}</th><th className="px-4 py-3 text-right font-semibold">{t("courses.enrollments")}</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{courses.map((course) => <tr key={course.id}><td className="px-4 py-3 font-medium text-slate-950 dark:text-white">{course.name}</td><td className="px-4 py-3 text-slate-500 dark:text-slate-400">{course.teacher.user.name}</td><td className="px-4 py-3 text-right font-semibold text-slate-950 dark:text-white">{course._count.students}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
