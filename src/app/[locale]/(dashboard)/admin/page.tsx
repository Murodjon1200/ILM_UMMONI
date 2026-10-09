import type { PaymentStatus } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";

import { formatSom } from "@/lib/currency";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const paymentStatusStyles: Record<PaymentStatus, string> = {
  PAID: "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300",
  PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  FAILED: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  REFUNDED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function AdminPage() {
  const t = await getTranslations("admin");
  const common = await getTranslations("common");
  const statusT = await getTranslations("status");
  const locale = await getLocale();
  const numberLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ";
  const [
    totalStudents,
    totalTeachers,
    totalCourses,
    paymentSummary,
    paidPaymentCount,
    recentPayments,
  ] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "TEACHER" } }),
    db.course.count(),
    db.payment.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
    db.payment.count({ where: { status: "PAID" } }),
    db.payment.findMany({
      take: 6,
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

  const totalCollected = Number(paymentSummary._sum.amount ?? 0);
  const stats = [
    {
      label: t("overview.totalStudents"),
      value: formatNumber(totalStudents),
      detail: t("overview.activeStudents"),
      accent: "bg-brand-500",
      icon: "ST",
    },
    {
      label: t("overview.teachers"),
      value: formatNumber(totalTeachers),
      detail: t("overview.teachingTeam"),
      accent: "bg-cyan-500",
      icon: "TE",
    },
    {
      label: t("overview.courses"),
      value: formatNumber(totalCourses),
      detail: t("overview.catalogPrograms"),
      accent: "bg-violet-500",
      icon: "CO",
    },
    {
      label: t("overview.payments"),
      value: formatSom(totalCollected, numberLocale),
      detail: `${formatNumber(paidPaymentCount)} ${t("overview.completedPayments")}`,
      accent: "bg-amber-500",
      icon: "PA",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-400">
            {t("overview.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {t("overview.welcome")}
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {t("overview.description")}
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-300">
          <span className="h-2 w-2 rounded-full bg-brand-500" />
          {t("overview.database")}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <section
            key={stat.label}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${stat.accent}`} />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {stat.value}
                </p>
              </div>
              <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {stat.icon}
              </span>
            </div>
            <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">
              {stat.detail}
            </p>
          </section>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-200 px-6 py-5 dark:border-slate-800 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-slate-950 dark:text-white">
              {t("overview.recentPayments")}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("overview.transactionsDescription")}
            </p>
          </div>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {formatNumber(recentPayments.length)} {t("overview.shown")}
          </span>
        </div>
        {recentPayments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-semibold">{common("student")}</th>
                  <th className="px-6 py-4 font-semibold">{common("course")}</th>
                  <th className="px-6 py-4 font-semibold">{common("date")}</th>
                  <th className="px-6 py-4 font-semibold">{common("status")}</th>
                  <th className="px-6 py-4 text-right font-semibold">{common("amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentPayments.map((payment) => (
                  <tr key={payment.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      {payment.student.user.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {payment.student.course.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {formatDate(payment.date)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentStatusStyles[payment.status]}`}>
                        {statusT(payment.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-white">
                      {formatSom(Number(payment.amount), numberLocale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            {common("noPayments")}
          </div>
        )}
      </section>
    </div>
  );
}
