import { getDayOfWeekInTashkent } from "@/lib/date";
import { db } from "@/lib/db";
import { forbidden } from "@/lib/mobile/api-error";
import type { MobileUser } from "@/lib/mobile/session";
import { levelProgress } from "@/lib/xp";

/** The Parent row for a user, or null. */
export async function getParentProfile(userId: string) {
  return db.parent.findUnique({
    where: { userId },
    select: { id: true },
  });
}

function startOfWeek(reference = new Date()) {
  const day = getDayOfWeekInTashkent(reference); // Monday = 1 ... Sunday = 7
  const date = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()),
  );

  date.setUTCDate(date.getUTCDate() - (day - 1));

  return date;
}

/**
 * Seven-day summary of every child: attendance, grades, payments and XP gained
 * since Monday. Used by both the parent dashboard and the mobile endpoint.
 */
export async function weeklyReport(user: MobileUser) {
  if (user.role !== "PARENT") {
    throw forbidden();
  }

  const parent = await getParentProfile(user.id);

  if (!parent) {
    throw forbidden();
  }

  const weekStart = startOfWeek();
  const today = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
  );

  const children = await db.student.findMany({
    where: { parentId: parent.id },
    select: {
      id: true,
      startDate: true,
      course: { select: { id: true, name: true } },
      user: { select: { name: true } },
    },
  });

  const childIds = children.map((child) => child.id);

  if (childIds.length === 0) {
    return { weekStart: weekStart.toISOString(), children: [], totalXP: 0 };
  }

  const [attendance, grades, payments, xpLogs, stats] = await Promise.all([
    db.attendance.findMany({
      where: { studentId: { in: childIds }, date: { gte: weekStart } },
      select: { studentId: true, date: true, status: true },
    }),
    db.grade.findMany({
      where: { studentId: { in: childIds }, date: { gte: weekStart } },
      select: { id: true, studentId: true, score: true, comment: true, date: true },
    }),
    db.payment.findMany({
      where: { studentId: { in: childIds }, date: { gte: weekStart } },
      select: { id: true, studentId: true, amount: true, status: true, date: true },
    }),
    db.xPLog.findMany({
      where: { studentId: { in: childIds }, createdAt: { gte: weekStart } },
      select: { studentId: true, points: true },
    }),
    db.studentStats.findMany({
      where: { studentId: { in: childIds } },
      select: { studentId: true, totalXP: true, currentStreak: true, longestStreak: true },
    }),
  ]);

  const reports = children.map((child) => {
    const childAttendance = attendance.filter((row) => row.studentId === child.id);
    const present = childAttendance.filter(
      (row) => row.status === "PRESENT" || row.status === "LATE",
    ).length;
    const childGrades = grades.filter((row) => row.studentId === child.id);
    const childPayments = payments.filter((row) => row.studentId === child.id);
    const childXp = xpLogs.filter((row) => row.studentId === child.id);
    const childStats = stats.find((row) => row.studentId === child.id);
    const totalXP = childStats?.totalXP ?? 0;

    const todayStatus =
      childAttendance.find((row) => row.date.toISOString().slice(0, 10) === today.toISOString().slice(0, 10))
        ?.status ?? null;

    return {
      studentId: child.id,
      name: child.user.name,
      courseName: child.course.name,
      totalXP,
      xpThisWeek: childXp.reduce((sum, row) => sum + row.points, 0),
      level: levelProgress(totalXP).level,
      levelName: levelProgress(totalXP).levelName,
      emoji: levelProgress(totalXP).emoji,
      currentStreak: childStats?.currentStreak ?? 0,
      longestStreak: childStats?.longestStreak ?? 0,
      attendanceThisWeek: {
        total: childAttendance.length,
        present: present,
        absent: childAttendance.length - present,
        percent:
          childAttendance.length === 0
            ? 0
            : Math.round((present / childAttendance.length) * 100),
      },
      todayStatus,
      gradesThisWeek: childGrades.map((grade) => ({
        id: grade.id,
        score: Number(grade.score),
        comment: grade.comment,
        date: grade.date.toISOString(),
      })),
      averageScore:
        childGrades.length === 0
          ? null
          : Math.round(
              (childGrades.reduce((sum, grade) => sum + Number(grade.score), 0) /
                childGrades.length) *
                100,
            ) / 100,
      paymentsThisWeek: childPayments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        status: payment.status,
        date: payment.date.toISOString(),
      })),
    };
  });

  return {
    weekStart: weekStart.toISOString(),
    children: reports,
    totalXP: reports.reduce((sum, report) => sum + report.xpThisWeek, 0),
  };
}

/** Whole-history snapshot used by the parent dashboard header. */
export async function childOverview(user: MobileUser) {
  if (user.role !== "PARENT") {
    throw forbidden();
  }

  const parent = await getParentProfile(user.id);

  if (!parent) {
    throw forbidden();
  }

  const children = await db.student.findMany({
    where: { parentId: parent.id },
    select: {
      id: true,
      course: { select: { name: true } },
      user: { select: { name: true } },
    },
  });

  const childIds = children.map((child) => child.id);

  if (childIds.length === 0) {
    return { children: [] };
  }

  const [stats, attendance, grades, awards, badges] = await Promise.all([
    db.studentStats.findMany({ where: { studentId: { in: childIds } } }),
    db.attendance.findMany({
      where: { studentId: { in: childIds } },
      select: { studentId: true, status: true },
    }),
    db.grade.findMany({
      where: { studentId: { in: childIds } },
      select: { studentId: true, score: true },
    }),
    db.achievement.findMany({ where: { studentId: { in: childIds } } }),
    db.parentNotification.findMany({
      where: { parentId: parent.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    children: children.map((child) => {
      const childStats = stats.find((row) => row.studentId === child.id);
      const childAttendance = attendance.filter((row) => row.studentId === child.id);
      const present = childAttendance.filter(
        (row) => row.status === "PRESENT" || row.status === "LATE",
      ).length;
      const childGrades = grades.filter((row) => row.studentId === child.id);
      const totalXP = childStats?.totalXP ?? 0;
      const progress = levelProgress(totalXP);

      return {
        studentId: child.id,
        name: child.user.name,
        courseName: child.course.name,
        totalXP,
        level: progress.level,
        levelName: progress.levelName,
        emoji: progress.emoji,
        percent: progress.percent,
        currentStreak: childStats?.currentStreak ?? 0,
        attendancePercent:
          childAttendance.length === 0
            ? 0
            : Math.round((present / childAttendance.length) * 100),
        averageScore:
          childGrades.length === 0
            ? null
            : Math.round(
                (childGrades.reduce((sum, grade) => sum + Number(grade.score), 0) /
                  childGrades.length) *
                  100,
              ) / 100,
        badges: awards
          .filter((award) => award.studentId === child.id)
          .map((award) => award.badge),
      };
    }),
    notifications: badges.map((row) => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      body: row.body,
      read: row.readAt !== null,
      createdAt: row.createdAt.toISOString(),
    })),
    unreadCount: badges.filter((row) => row.readAt === null).length,
  };
}