import { PaymentMethod, PaymentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";

import { formatSom } from "@/lib/currency";
import { db } from "@/lib/db";

import { createPayment, updatePaymentStatus } from "../actions";

export const dynamic = "force-dynamic";

interface PaymentsPageProps {
  searchParams: {
    error?: string | string[];
    method?: string | string[];
    status?: string | string[];
    success?: string | string[];
  };
}

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

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const t = await getTranslations("admin");
  const common = await getTranslations("common");
  const locale = await getLocale();
  const numberLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ";
  const statusParam = getParam(searchParams.status);
  const methodParam = getParam(searchParams.method);
  const success = getParam(searchParams.success);
  const error = getParam(searchParams.error);
  const status = Object.values(PaymentStatus).includes(
    statusParam as PaymentStatus,
  )
    ? (statusParam as PaymentStatus)
    : "";
  const method = Object.values(PaymentMethod).includes(
    methodParam as PaymentMethod,
  )
    ? (methodParam as PaymentMethod)
    : "";

  const where: Prisma.PaymentWhereInput = {
    ...(status ? { status } : {}),
    ...(method ? { method } : {}),
  };

  const [payments, students, summary, paidCount, pendingCount] =
    await Promise.all([
      db.payment.findMany({
        where,
        orderBy: { date: "desc" },
        take: 100,
        include: {
          student: {
            select: {
              course: { select: { name: true } },
              user: { select: { name: true } },
            },
          },
        },
      }),
      db.student.findMany({
        orderBy: { user: { name: "asc" } },
        select: {
          id: true,
          course: { select: { name: true } },
          user: { select: { name: true } },
        },
      }),
      db.payment.aggregate({
        where,
        _sum: { amount: true },
      }),
      db.payment.count({ where: { ...where, status: "PAID" } }),
      db.payment.count({ where: { ...where, status: "PENDING" } }),
    ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
            {t("nav.payments")}
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {t("payments.title")}
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Review payment history, methods, and transaction status.
          </p>
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {payments.length} {payments.length === 1 ? "record" : "records"}
        </p>
      </div>

      {success ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300">
          {success}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-slate-950 dark:text-white">{t("payments.record")}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Receipt numbers are generated automatically and payments cannot be deleted.
            </p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Admin only
          </span>
        </div>
        <form action={createPayment} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Student enrollment
            <select
              name="studentId"
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="" disabled>Select student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.user.name} · {student.course.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Amount (so&apos;m)
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Date
            <input
              name="date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Method
            <select
              name="method"
              defaultValue="CASH"
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              {Object.values(PaymentMethod).map((value) => (
                <option key={value} value={value}>{methodLabels[value]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Status
            <select
              name="status"
              defaultValue="PAID"
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              {Object.values(PaymentStatus).map((value) => (
                <option key={value} value={value}>{value.toLowerCase()}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-5">
            <button
              type="submit"
              disabled={students.length === 0}
              className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300 sm:w-auto"
            >
              {t("payments.record")}
            </button>
          </div>
        </form>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("payments.total")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
            {formatSom(Number(summary._sum.amount ?? 0), numberLocale)}
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("payments.paid")}</p>
          <p className="mt-2 text-2xl font-bold text-brand-600 dark:text-brand-400">
            {paidCount}
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("payments.pending")}</p>
          <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {pendingCount}
          </p>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800 lg:flex-row lg:items-center">
          <div>
            <h3 className="font-semibold text-slate-950 dark:text-white">            {t("payments.history")}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Filter the table by status and payment method.
            </p>
          </div>
          <form method="get" className="flex flex-col gap-2 sm:flex-row">
            <select
              name="status"
              defaultValue={status}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="">All statuses</option>
              {Object.values(PaymentStatus).map((value) => (
                <option key={value} value={value}>
                  {value.toLowerCase()}
                </option>
              ))}
            </select>
            <select
              name="method"
              defaultValue={method}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="">All methods</option>
              {Object.values(PaymentMethod).map((value) => (
                <option key={value} value={value}>
                  {methodLabels[value]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
            >
              Apply
            </button>
            {status || method ? (
              <a
                href="/admin/payments"
                className="rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Clear
              </a>
            ) : null}
          </form>
        </div>
        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">{t("payments.receipt")}</th>
                  <th className="px-5 py-4 font-semibold">{common("student")}</th>
                  <th className="px-5 py-4 font-semibold">{common("course")}</th>
                  <th className="px-5 py-4 font-semibold">{common("date")}</th>
                  <th className="px-5 py-4 font-semibold">Method</th>
                  <th className="px-5 py-4 font-semibold">{common("status")}</th>
                  <th className="px-5 py-4 text-right font-semibold">{common("amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((payment) => (
                  <tr key={payment.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                      {payment.receiptNumber}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-950 dark:text-white">
                      {payment.student.user.name}
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                      {payment.student.course.name}
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                      {formatDate(payment.date)}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {methodLabels[payment.method]}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[payment.status]}`}>
                          {payment.status.toLowerCase()}
                        </span>
                        <form
                          action={updatePaymentStatus.bind(null, payment.id)}
                          className="flex items-center gap-1"
                        >
                          <select
                            name="status"
                            defaultValue={payment.status}
                            aria-label={`Update status for ${payment.receiptNumber}`}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                          >
                            {Object.values(PaymentStatus).map((value) => (
                              <option key={value} value={value}>
                                {value.toLowerCase()}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            Save
                          </button>
                        </form>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-950 dark:text-white">
                      {formatSom(Number(payment.amount), numberLocale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            {t("payments.empty")}
          </div>
        )}
      </section>
    </div>
  );
}