import { db } from "@/lib/db";
import { streakMilestones } from "@/lib/xp";

export type BadgeKey =
  | "PERFECT_SCORE"
  | "STREAK_10"
  | "STREAK_30"
  | "TOP_WEEKLY"
  | "FULL_ATTENDANCE"
  | "FAST_PAYER";

export interface BadgeDef {
  key: BadgeKey;
  label: string;
  description: string;
  emoji: string;
}

export const badgeCatalog: Record<BadgeKey, BadgeDef> = {
  PERFECT_SCORE: {
    key: "PERFECT_SCORE",
    label: "Mukammal ballar",
    description: "5 ta 100 ball",
    emoji: "🎯",
  },
  STREAK_10: {
    key: "STREAK_10",
    label: "10 kunlik seriya",
    description: "10 dars davomatga qatnashish",
    emoji: "🔥",
  },
  STREAK_30: {
    key: "STREAK_30",
    label: "30 kunlik seriya",
    description: "30 dars davomatga qatnashish",
    emoji: "⚡",
  },
  TOP_WEEKLY: {
    key: "TOP_WEEKLY",
    label: "Haftalik yetakchi",
    description: "Kursda haftalik 1-o'rin",
    emoji: "👑",
  },
  FULL_ATTENDANCE: {
    key: "FULL_ATTENDANCE",
    label: "To'liq davomat",
    description: "1 oy 100% davomat",
    emoji: "📅",
  },
  FAST_PAYER: {
    key: "FAST_PAYER",
    label: "Tezkor to'lovchi",
    description: "To'lovni muddatidan oldin",
    emoji: "💳",
  },
};

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * A month counts as full attendance when every scheduled class date in that
 * calendar month has a PRESENT or LATE row and there is at least one class.
 */
export async function hasFullAttendanceMonth(studentId: string, reference = new Date()) {
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));

  const [schedules, attendance] = await Promise.all([
    db.schedule.findMany({
      where: { course: { students: { some: { id: studentId } } } },
      select: { dayOfWeek: true },
    }),
    db.attendance.findMany({
      where: { studentId, date: { gte: start, lt: end } },
      select: { date: true, status: true },
    }),
  ]);

  if (schedules.length === 0) {
    return false;
  }

  const attendedDays = new Set(
    attendance
      .filter((row) => row.status === "PRESENT" || row.status === "LATE")
      .map((row) => dayKey(row.date)),
  );

  // Walk every day of the month; a class day is one whose weekday is scheduled.
  let expected = 0;
  const cursor = new Date(start);

  while (cursor < end) {
    // Monday = 1 ... Sunday = 7, matching Schedule.dayOfWeek.
    const weekday = ((cursor.getUTCDay() + 6) % 7) + 1;

    if (schedules.some((schedule) => schedule.dayOfWeek === weekday)) {
      expected += 1;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return expected > 0 && attendedDays.size >= expected;
}

export async function hasFivePerfectScores(studentId: string) {
  const perfect = await db.grade.count({
    where: { studentId, score: { gte: 100 } },
  });

  return perfect >= 5;
}

export async function hasPaidOnTime(studentId: string) {
  // The schema has no payment due date, so "on time" is taken to mean a PAID
  // payment recorded no later than the end of the month after enrolment.
  const enrollment = await db.student.findUnique({
    where: { id: studentId },
    select: { startDate: true },
  });

  if (!enrollment) {
    return false;
  }

  const start = enrollment.startDate;
  const deadline = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59),
  );

  const paid = await db.payment.count({
    where: { studentId, status: "PAID", date: { lte: deadline } },
  });

  return paid > 0;
}

/**
 * Grants any badge whose condition is now met. Safe to call repeatedly: the
 * unique (studentId, badge) constraint makes it idempotent.
 */
export async function evaluateBadges(studentId: string) {
  const [stats, perfect, fullMonth, fastPayer] = await Promise.all([
    db.studentStats.findUnique({
      where: { studentId },
      select: { longestStreak: true, currentStreak: true },
    }),
    hasFivePerfectScores(studentId),
    hasFullAttendanceMonth(studentId),
    hasPaidOnTime(studentId),
  ]);

  const longest = Math.max(stats?.longestStreak ?? 0, stats?.currentStreak ?? 0);

  const candidates: BadgeKey[] = [];

  if (perfect) candidates.push("PERFECT_SCORE");
  if (longest >= 30) candidates.push("STREAK_30");
  else if (longest >= 10) candidates.push("STREAK_10");
  if (fullMonth) candidates.push("FULL_ATTENDANCE");
  if (fastPayer) candidates.push("FAST_PAYER");

  const granted: BadgeKey[] = [];

  for (const badge of candidates) {
    try {
      await db.achievement.create({ data: { studentId, badge } });
      granted.push(badge);
    } catch (error) {
      const code = (error as { code?: string })?.code;

      if (code !== "P2002") {
        throw error;
      }
    }
  }

  return granted;
}

/** Streak milestones pay a one-off XP bonus. */
export async function awardStreakBonuses(studentId: string, longestStreak: number) {
  const { awardXp } = await import("@/lib/xp");

  for (const milestone of streakMilestones) {
    if (longestStreak >= milestone.days) {
      await awardXp({
        studentId,
        action: "BONUS",
        points: milestone.points,
        description: `${milestone.days} kunlik seriya`,
        sourceKey: `streak:${studentId}:${milestone.days}`,
      });
    }
  }
}

export async function leaderboardForCourse(courseId: string, limit = 10) {
  const stats = await db.studentStats.findMany({
    where: { student: { courseId } },
    orderBy: { totalXP: "desc" },
    take: limit,
    select: {
      totalXP: true,
      currentStreak: true,
      student: {
        select: { id: true, user: { select: { name: true } } },
      },
    },
  });

  return stats.map((row, index) => ({
    rank: index + 1,
    studentId: row.student.id,
    name: row.student.user.name,
    totalXP: row.totalXP,
    currentStreak: row.currentStreak,
  }));
}