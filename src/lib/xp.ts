import { db } from "@/lib/db";

export type XpAction = "ATTENDANCE" | "GRADE" | "PAYMENT" | "STREAK" | "BONUS";

export const xpRules = {
  attendance: { PRESENT: 10, LATE: 5, ABSENT: 0, EXCUSED: 0 },
  grade: { perfect: 20, good: 10, pass: 5 },
  paymentOnTime: 15,
  weeklyPerfectBonus: 50,
  streakTenBonus: 30,
  streakThirtyBonus: 60,
} as const;

export interface LevelDef {
  level: number;
  name: string;
  emoji: string;
  minXP: number;
  /** Exclusive upper bound; Infinity for the final level. */
  maxXP: number;
}

export const levels: LevelDef[] = [
  { level: 1, name: "Yangi o'quvchi", emoji: "🌱", minXP: 0, maxXP: 101 },
  { level: 2, name: "Faol o'quvchi", emoji: "⭐", minXP: 101, maxXP: 301 },
  { level: 3, name: "Zo'r o'quvchi", emoji: "🔥", minXP: 301, maxXP: 601 },
  { level: 4, name: "A'lochi", emoji: "💎", minXP: 601, maxXP: 1001 },
  { level: 5, name: "Chempion", emoji: "🏆", minXP: 1001, maxXP: Number.POSITIVE_INFINITY },
];

export function levelFor(totalXP: number): LevelDef {
  const xp = Math.max(0, totalXP);

  return (
    levels.find((level) => xp >= level.minXP && xp < level.maxXP) ??
    levels[levels.length - 1]
  );
}

export interface LevelProgress {
  level: number;
  levelName: string;
  emoji: string;
  totalXP: number;
  /** Progress through the current level, 0-100. */
  percent: number;
  xpIntoLevel: number;
  xpForNextLevel: number | null;
  nextLevelName: string | null;
}

export function levelProgress(totalXP: number): LevelProgress {
  const current = levelFor(totalXP);
  const span =
    current.maxXP === Number.POSITIVE_INFINITY
      ? null
      : current.maxXP - current.minXP;
  const into = Math.max(0, totalXP - current.minXP);

  return {
    level: current.level,
    levelName: current.name,
    emoji: current.emoji,
    totalXP,
    percent: span === null ? 100 : Math.min(100, Math.round((into / span) * 100)),
    xpIntoLevel: into,
    xpForNextLevel: span === null ? null : span - into,
    nextLevelName:
      span === null ? null : (levels.find((l) => l.level === current.level + 1)?.name ?? null),
  };
}

export function gradePoints(score: number) {
  if (score >= 90) return xpRules.grade.perfect;
  if (score >= 70) return xpRules.grade.good;
  if (score >= 50) return xpRules.grade.pass;
  return 0;
}

export function attendancePoints(status: string) {
  if (status === "PRESENT") return xpRules.attendance.PRESENT;
  if (status === "LATE") return xpRules.attendance.LATE;
  return 0;
}

export const streakMilestones = [
  { days: 10, points: xpRules.streakTenBonus },
  { days: 30, points: xpRules.streakThirtyBonus },
] as const;

function startOfTashkentDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Consecutive *scheduled class days* attended (PRESENT or LATE), counting back
 * from the most recent attendance row. The centre does not hold daily
 * attendance, so a literal calendar-day streak would be unreachable for a
 * twice-weekly course.
 */
export async function computeStreak(studentId: string) {
  const rows = await db.attendance.findMany({
    where: { studentId },
    select: { date: true, status: true, scheduleId: true },
    orderBy: { date: "desc" },
    take: 120,
  });

  const attended = rows.filter(
    (row) => row.status === "PRESENT" || row.status === "LATE",
  );

  if (attended.length === 0) {
    return { current: 0, longest: 0 };
  }

  const days = new Set(
    attended.map((row) => startOfTashkentDay(row.date).toISOString().slice(0, 10)),
  );

  // Map each scheduled weekday to the class dates that actually occurred, then
  // walk distinct attended dates looking for gaps.
  const schedules = await db.schedule.findMany({
    where: { course: { students: { some: { id: studentId } } } },
    select: { dayOfWeek: true },
  });
  const weekdays = new Set(schedules.map((schedule) => schedule.dayOfWeek));

  const distinct = [...days].sort().reverse();
  let current = 0;
  let longest = 0;
  let run = 0;
  let previous: string | null = null;

  for (const day of distinct) {
    if (previous === null) {
      run = 1;
    } else {
      const previousDate: Date = new Date(`${previous}T00:00:00.000Z`);
      const expected: Date = new Date(previousDate);
      expected.setUTCDate(expected.getUTCDate() + 1);

      // Skip non-class days: advance to the next scheduled weekday.
      let guard = 0;
      while (!weekdays.has(((expected.getUTCDay() + 6) % 7) + 1) && guard < 8) {
        expected.setUTCDate(expected.getUTCDate() + 1);
        guard += 1;
      }

      if (expected.toISOString().slice(0, 10) === day) {
        run += 1;
      } else {
        run = 1;
      }
    }

    previous = day;
    current = run;
    longest = Math.max(longest, run);
  }

  return { current, longest };
}

/**
 * Awards XP once per source record. The unique `sourceKey` makes a repeat call a
 * no-op instead of double-paying, which matters because attendance and grades are
 * upserted and re-saved.
 */
export async function awardXp(input: {
  studentId: string;
  action: XpAction;
  points: number;
  description: string;
  sourceKey: string;
}) {
  if (input.points <= 0) {
    return { awarded: 0, totalXP: await totalXp(input.studentId) };
  }

  const result = await db.$transaction(async (transaction) => {
    // Ignore the unique-violation so concurrent saves cannot both pay out.
    const inserted = await transaction.xPLog
      .create({
        data: {
          studentId: input.studentId,
          action: input.action,
          points: input.points,
          description: input.description,
          sourceKey: input.sourceKey,
        },
      })
      .catch((error: unknown) => {
        const code = (error as { code?: string })?.code;
        return code === "P2002" ? null : Promise.reject(error);
      });

    if (!inserted) {
      return null;
    }

    const stats = await transaction.studentStats.upsert({
      where: { studentId: input.studentId },
      create: { studentId: input.studentId, totalXP: input.points },
      update: { totalXP: { increment: input.points } },
    });

    return stats;
  });

  const totalXP = await totalXp(input.studentId);

  if (!result) {
    return { awarded: 0, totalXP };
  }

  await db.studentStats.update({
    where: { studentId: input.studentId },
    data: { level: levelFor(totalXP).level },
  });

  return { awarded: input.points, totalXP };
}

export async function totalXp(studentId: string) {
  const stats = await db.studentStats.findUnique({
    where: { studentId },
    select: { totalXP: true },
  });

  return stats?.totalXP ?? 0;
}

export async function refreshStreak(studentId: string) {
  const { current, longest } = await computeStreak(studentId);

  const stats = await db.studentStats.upsert({
    where: { studentId },
    create: {
      studentId,
      currentStreak: current,
      longestStreak: longest,
    },
    update: { currentStreak: current, longestStreak: Math.max(longest, current) },
  });

  return stats;
}