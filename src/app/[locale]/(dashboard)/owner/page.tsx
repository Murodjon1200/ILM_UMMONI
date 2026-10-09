import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import {
  EnrollmentBarChart,
  RevenueChart,
  StudentGrowthChart,
} from "@/components/owner/charts";
import { formatSom } from "@/lib/currency";
import { getCurrentMonthRange } from "@/lib/date";
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

export default async function OwnerOverviewPage() {
  const t = await getTranslations("owner");
  const common = await getTranslations("common");
  const statusT = await getTranslations("status");
  const locale = await getLocale();
  const numberLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ";
  const { owner } = await getOwnerContext();
  const now = new Date();
  const currentMonth = getCurrentMonthRange(now);
  const previousMonthStart = new Date(
    Date.UTC(currentMonth.start.getUTCFullYear(), currentMonth.start.getUTCMonth() - 1, 1),
  );
  const sixMonthsAgo = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
  );
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const revenueMonths = getMonthKeys(12, now);
  const growthMonths = getMonthKeys(6, now);

  const [
    totalStudents,
    totalTeachers,
    totalCourses,
    recentStudents,
    completedPayments,
    topCourses,
    recentPayments,
  ] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "TEACHER" } }),
    db.course.count(),
    db.user.findMany({
      where: { role: "STUDENT", createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    }),
    db.payment.findMany({
      where: { status: "PAID" },
      select: { amount: true, date: true },
    }),
    db.course.findMany({
      take: 3,
      orderBy: { students: { _count: "desc" } },
      include: {
        _count: { select: { students: true } },
        teacher: { include: { user: { select: { name: true } } } },
      },
    }),
    db.payment.findMany({
      take: 5,
      orderBy: { date: "desc" },
      include: {
        student: {
          select: {
            course: { select: { name: true } },
            user: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const currentMonthStudents = recentStudents.filter(
    (student) => student.createdAt >= currentMonth.start,
  ).length;
  const previousMonthStudents = recentStudents.filter(
    (student) =>
      student.createdAt >= previousMonthStart &&
      student.createdAt < currentMonth.start,
  ).length;
  const studentGrowth = previousMonthStudents
    ? Math.round(
        ((currentMonthStudents - previousMonthStudents) /
          previousMonthStudents) *
          100,
      )
    : currentMonthStudents
      ? 100
      : 0;
  const monthlyRevenue = completedPayments
    .filter(
      (payment) =>
        payment.date >= currentMonth.start && payment.date < currentMonth.end,
    )
    .reduce((total, payment) => total + Number(payment.amount), 0);
  const annualRevenue = completedPayments
    .filter((payment) => payment.date >= yearStart)
    .reduce((total, payment) => total + Number(payment.amount), 0);
  const revenueData = revenueMonths.map((month) => ({
    month,
    revenue: completedPayments
      .filter((payment) => payment.date.toISOString().startsWith(month))
      .reduce((total, payment) => total + Number(payment.amount), 0),
  }));
  const studentGrowthData = growthMonths.map((month) => ({
    month,
    students: recentStudents.filter((student) =>
      student.createdAt.toISOString().startsWith(month),
    ).length,
  }));
  const topCourseChart = topCourses.map((course) => ({
    name: course.name,
    students: course._count.students,
  }));

  const cards = [
    {
      label: t("overview.students"),
      value: totalStudents.toLocaleString(numberLocale),
      detail: `${studentGrowth >= 0 ? "+" : ""}${studentGrowth}%`,
      color: "bg-brand-500",
    },
    {
      label: t("overview.teachers"),
      value: totalTeachers.toLocaleString(numberLocale),
      detail: t("readOnly"),
      color: "bg-cyan-500",
    },
    {
      label: t("overview.courses"),
      value: totalCourses.toLocaleString(numberLocale),
      detail: t("readOnly"),
      color: "bg-violet-500",
    },
    {
      label: t("overview.monthlyRevenue"),
      value: formatSom(monthlyRevenue, numberLocale),
      detail: formatSom(annualRevenue, numberLocale),
      color: "bg-amber-500",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
            {t("overview.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {t("overview.welcome")}, {owner.name}
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {t("readOnly")}
          </p>
        </div>
        <Link
          href="/owner/statistics"
          className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-amber-400 dark:text-slate-950"
        >
          {t("overview.viewAll")}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <section
            key={card.label}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${card.color}`} />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {card.label}
            </p>
            <p className="mt-3 text-2xl font-bold text-slate-950 dark:text-white">
              {card.value}
            </p>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              {card.detail}
            </p>
          </section>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-semibold text-slate-950 dark:text-white">
          {t("overview.revenueChart")}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t("overview.annualRevenue")}: {formatSom(annualRevenue, numberLocale)}
        </p>
        <div className="mt-5">
          <RevenueChart data={revenueData} locale={numberLocale} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-950 dark:text-white">
            {t("overview.topCourses")}
          </h3>
          <div className="mt-5">
            <EnrollmentBarChart data={topCourseChart} />
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-950 dark:text-white">
            {t("overview.studentGrowth")}
          </h3>
          <div className="mt-5">
            <StudentGrowthChart data={studentGrowthData} locale={numberLocale} />
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <h3 className="font-semibold text-slate-950 dark:text-white">
            {t("overview.recentPayments")}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
              <tr>
                <th className="px-5 py-4 font-semibold">{common("student")}</th>
                <th className="px-5 py-4 font-semibold">{common("course")}</th>
                <th className="px-5 py-4 font-semibold">{common("date")}</th>
                <th className="px-5 py-4 font-semibold">{common("status")}</th>
                <th className="px-5 py-4 text-right font-semibold">{common("amount")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentPayments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-5 py-4 font-medium text-slate-950 dark:text-white">
                    {payment.student.user.name}
                  </td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                    {payment.student.course.name}
                  </td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                    {payment.date.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-5 py-4">{statusT(payment.status)}</td>
                  <td className="px-5 py-4 text-right font-semibold text-slate-950 dark:text-white">
                    {formatSom(Number(payment.amount), numberLocale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
