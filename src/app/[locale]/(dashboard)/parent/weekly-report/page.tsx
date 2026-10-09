import { getTranslations } from "next-intl/server";

import { formatReadableDate } from "@/lib/date";
import { getParentContext } from "@/lib/parent-context";
import { weeklyReport } from "@/lib/mobile/parent-report";
import type { MobileUser } from "@/lib/mobile/session";

export default async function ParentWeeklyReportPage() {
  const t = await getTranslations("parent");
  const { session } = await getParentContext();

  const report = await weeklyReport({
    ...session.user,
    role: "PARENT",
  } as unknown as MobileUser);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          {t("weeklyTitle")}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t("weeklyDescription", { date: formatReadableDate(report.weekStart) })} ·{" "}
          {report.totalXP} XP
        </p>
      </div>

      {report.children.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {t("noChildren")}
        </p>
      ) : (
        report.children.map((child) => (
          <section
            key={child.studentId}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-950 dark:text-white">
                {child.name}
              </h3>
              <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                {child.emoji} {child.levelName} · {child.xpThisWeek} XP
              </p>
            </div>

            <dl className="mt-4 grid gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">
                  {t("attendance")}
                </dt>
                <dd className="mt-1 font-semibold text-slate-950 dark:text-white">
                  {child.attendanceThisWeek.present}/{child.attendanceThisWeek.total} (
                  {child.attendanceThisWeek.percent}%)
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">
                  {t("average")}
                </dt>
                <dd className="mt-1 font-semibold text-slate-950 dark:text-white">
                  {child.averageScore ?? t("noGrades")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">
                  {t("streak")}
                </dt>
                <dd className="mt-1 font-semibold text-orange-500">
                  🔥 {child.currentStreak}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">
                  {t("today")}
                </dt>
                <dd className="mt-1 font-semibold text-slate-950 dark:text-white">
                  {child.todayStatus ? t(`status.${child.todayStatus}`) : t("noRecordToday")}
                </dd>
              </div>
            </dl>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  {t("latestGrades")}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  {child.gradesThisWeek.map((grade) => (
                    <li key={grade.id}>
                      {formatReadableDate(grade.date)} — {grade.score}
                      {grade.comment ? ` · ${grade.comment}` : ""}
                    </li>
                  ))}
                  {child.gradesThisWeek.length === 0 ? (
                    <li className="text-slate-400">{t("noGrades")}</li>
                  ) : null}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  {t("paymentStatus")}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  {child.paymentsThisWeek.map((payment) => (
                    <li key={payment.id}>
                      {formatReadableDate(payment.date)} — {payment.amount} ·{" "}
                      {t(`status.${payment.status}`)}
                    </li>
                  ))}
                  {child.paymentsThisWeek.length === 0 ? (
                    <li className="text-slate-400">{t("noPayments")}</li>
                  ) : null}
                </ul>
              </div>
            </div>
          </section>
        ))
      )}
    </div>
  );
}