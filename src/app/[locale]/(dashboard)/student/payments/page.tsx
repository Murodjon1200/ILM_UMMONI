import type { PaymentMethod, PaymentStatus } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";

import { formatSom } from "@/lib/currency";
import { formatReadableDate, getCurrentMonthRange } from "@/lib/date";
import { db } from "@/lib/db";
import { getStudentContext } from "@/lib/student-context";

const statusStyles: Record<PaymentStatus, string> = {
  PAID: "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300",
  PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  FAILED: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  REFUNDED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const methodLabels: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  OTHER: "Other",
};

export default async function StudentPaymentsPage() {
  const t = await getTranslations("student");
  const common = await getTranslations("common");
  const statusT = await getTranslations("status");
  const locale = await getLocale();
  const numberLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ";
  const { enrollments } = await getStudentContext();
  const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
  const month = getCurrentMonthRange();
  const payments = await db.payment.findMany({
    where: { studentId: { in: enrollmentIds } },
    orderBy: { date: "desc" },
    include: {
      student: {
        select: { course: { select: { name: true } } },
      },
    },
  });
  const currentMonthPayments = payments.filter((payment) => payment.date >= month.start && payment.date < month.end);
  const currentMonthPaid = currentMonthPayments.some((payment) => payment.status === "PAID");
  const totalPaid = payments.filter((payment) => payment.status === "PAID").reduce((total, payment) => total + Number(payment.amount), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">            {t("nav.payments")}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">            {t("payments.title")}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">            {t("payments.description")}</p>
        </div>
        <div className={`rounded-xl px-5 py-3 text-right ${currentMonthPaid ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"}`}><p className="text-xs font-semibold uppercase tracking-wider">{month.label}</p><p className="mt-1 text-2xl font-bold">{currentMonthPaid ? t("payments.paid") : t("payments.unpaid")}</p></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500 dark:text-slate-400">{t("payments.history")}</p><p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{payments.length}</p></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500 dark:text-slate-400">{t("payments.currentMonth")}</p><p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{formatSom(currentMonthPayments.reduce((total, payment) => total + Number(payment.amount), 0), numberLocale)}</p></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500 dark:text-slate-400">{t("payments.totalPaid")}</p><p className="mt-2 text-2xl font-bold text-brand-600 dark:text-brand-400">{formatSom(totalPaid, numberLocale)}</p></section>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900"><p className="font-semibold text-slate-950 dark:text-white">{t("payments.empty")}</p><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t("payments.description")}</p></div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-6 dark:border-slate-800"><h3 className="font-semibold text-slate-950 dark:text-white">{t("payments.history")}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("payments.download")}</p></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950/40 dark:text-slate-400"><tr><th className="px-5 py-4 font-semibold">{t("payments.receipt")}</th><th className="px-5 py-4 font-semibold">{common("course")}</th><th className="px-5 py-4 font-semibold">{common("date")}</th><th className="px-5 py-4 font-semibold">Method</th><th className="px-5 py-4 font-semibold">{common("status")}</th><th className="px-5 py-4 text-right font-semibold">{common("amount")}</th><th className="px-5 py-4 text-right font-semibold">{t("payments.download")}</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((payment) => (
                  <tr key={payment.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50"><td className="px-5 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">{payment.receiptNumber}</td><td className="px-5 py-4 font-medium text-slate-950 dark:text-white">{payment.student.course.name}</td><td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatReadableDate(payment.date)}</td><td className="px-5 py-4 text-slate-600 dark:text-slate-300">{methodLabels[payment.method]}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[payment.status]}`}>{statusT(payment.status)}</span></td><td className="px-5 py-4 text-right font-semibold text-slate-950 dark:text-white">{formatSom(Number(payment.amount), numberLocale)}</td><td className="px-5 py-4 text-right"><a href={`/api/payments/${encodeURIComponent(payment.receiptNumber)}`} className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{t("payments.download")}</a></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
