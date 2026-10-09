import { getTranslations } from "next-intl/server";

import { formatReadableDate } from "@/lib/date";
import { db } from "@/lib/db";
import { getParentContext } from "@/lib/parent-context";
import { childOverview } from "@/lib/mobile/parent-report";
import { getDayOfWeekInTashkent } from "@/lib/date";

export default async function ParentOverviewPage() {
  const t = await getTranslations("parent");
  const { session } = await getParentContext();

  const overview = (await childOverview({
    ...session.user,
    role: "PARENT",
  } as never)) as {
    children: {
      studentId: string;
      name: string;
      courseName: string;
      totalXP: number;
      level: number;
      levelName: string;
      emoji: string;
      percent: number;
      currentStreak: number;
      attendancePercent: number;
      averageScore: number | null;
      badges: string[];
    }[];
    notifications: {
      id: string;
      type: string;
      severity: string;
      title: string;
      body: string;
      read: boolean;
      createdAt: string;
    }[];
    unreadCount: number;
  };
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  const childIds = overview.children.map((child) => child.studentId);

  const [todayAttendance, latestGrades, latestPayments] = await Promise.all([
    childIds.length
      ? db.attendance.findMany({
          where: {
            studentId: { in: childIds },
            date: {
              gte: new Date(`${todayKey}T00:00:00.000Z`),
              lt: new Date(`${todayKey}T23:59:59.999Z`),
            },
          },
          select: { studentId: true, status: true, date: true },
        })
      : Promise.resolve([]),
    childIds.length
      ? db.grade.findMany({
          where: { studentId: { in: childIds } },
          orderBy: { date: "desc" },
          take: 8,
          select: {
            id: true,
            studentId: true,
            score: true,
            comment: true,
            date: true,
            course: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    childIds.length
      ? db.payment.findMany({
          where: { studentId: { in: childIds } },
          orderBy: { date: "desc" },
          take: 6,
          select: { id: true, studentId: true, amount: true, status: true, date: true },
        })
      : Promise.resolve([]),
  ]);

  const todayDay = getDayOfWeekInTashkent(today);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-8 text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
          {t("eyebrow")}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">
          {t("greeting", { name: session.user.name?.split(" ")[0] ?? "" })}
        </h2>
        <p className="mt-2 text-slate-400">{t("monitoringNote")}</p>
      </section>

      {overview.children.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {t("noChildren")}
        </p>
      ) : (
        overview.children.map((child) => {
          const todayRecord = todayAttendance.find(
            (row) => row.studentId === child.studentId,
          );

          return (
            <section
              key={child.studentId}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-950 dark:text-white">
                    {child.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {child.courseName}
                  </p>
                </div>
                <p className="text-3xl font-bold text-orange-500">
                  🔥 {child.currentStreak}
                </p>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-950 dark:text-white">
                    {child.emoji} {child.levelName}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {child.totalXP} XP
                  </span>
                </div>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${child.percent}%` }}
                  />
                </div>
              </div>

              <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-slate-500">
                    {t("today")}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                    {todayRecord
                      ? t(`status.${todayRecord.status}`)
                      : t("noRecordToday")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-slate-500">
                    {t("attendance")}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                    {child.attendancePercent}%
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-slate-500">
                    {t("average")}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                    {child.averageScore ?? t("noGrades")}
                  </dd>
                </div>
              </dl>

              {child.badges.length > 0 ? (
                <p className="mt-4 flex flex-wrap gap-2">
                  {child.badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400"
                    >
                      {badge}
                    </span>
                  ))}
                </p>
              ) : null}

              <p className="mt-4 text-xs text-slate-400">
                {t("weekDayNote", { day: t(`days.${todayDay}`) })}
              </p>
            </section>
          );
        })
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-950 dark:text-white">
            {t("latestGrades")}
          </h3>
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {latestGrades.map((grade) => (
              <li key={grade.id} className="flex items-center justify-between py-3 text-sm">
                <span className="text-slate-700 dark:text-slate-300">
                  {grade.course.name} · {formatReadableDate(grade.date)}
                </span>
                <span className="font-bold text-slate-950 dark:text-white">
                  {Number(grade.score)}
                </span>
              </li>
            ))}
            {latestGrades.length === 0 ? (
              <li className="py-3 text-sm text-slate-500">{t("noGrades")}</li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-950 dark:text-white">
            {t("paymentStatus")}
          </h3>
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {latestPayments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between py-3 text-sm">
                <span className="text-slate-700 dark:text-slate-300">
                  {formatReadableDate(payment.date)}
                </span>
                <span className="font-semibold text-slate-950 dark:text-white">
                  {payment.amount.toString()} · {t(`status.${payment.status}`)}
                </span>
              </li>
            ))}
            {latestPayments.length === 0 ? (
              <li className="py-3 text-sm text-slate-500">{t("noPayments")}</li>
            ) : null}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-semibold text-slate-950 dark:text-white">
          {t("notifications")}
          {overview.unreadCount > 0 ? ` (${overview.unreadCount})` : ""}
        </h3>
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {overview.notifications.map((notification) => (
            <li key={notification.id} className="py-3 text-sm">
              <p className="font-semibold text-slate-950 dark:text-white">
                {notification.title}
              </p>
              <p className="text-slate-500 dark:text-slate-400">{notification.body}</p>
              <p className="mt-1 text-xs text-slate-400">
                {formatReadableDate(notification.createdAt)}
              </p>
            </li>
          ))}
          {overview.notifications.length === 0 ? (
            <li className="py-3 text-sm text-slate-500">{t("noNotifications")}</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}