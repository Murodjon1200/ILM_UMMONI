import {
  badgeCatalog,
  evaluateBadges,
  leaderboardForCourse,
  type BadgeKey,
} from "@/lib/achievements";
import { db } from "@/lib/db";
import { forbidden } from "@/lib/mobile/api-error";
import type { MobileUser } from "@/lib/mobile/session";
import { levelProgress } from "@/lib/xp";

/**
 * Gamification payload for a student. Scoped to the caller's own enrollments;
 * the leaderboard is limited to the caller's own course.
 */
export async function getGamification(user: MobileUser) {
  if (user.role !== "STUDENT" && user.role !== "PARENT" && user.role !== "ADMIN") {
    throw forbidden();
  }

  const enrollments =
    user.role === "STUDENT"
      ? await db.student.findMany({
          where: { userId: user.id },
          select: { id: true, courseId: true },
        })
      : user.role === "PARENT"
        ? await db.student.findMany({
            where: { parent: { userId: user.id } },
            select: { id: true, courseId: true },
          })
        : await db.student.findMany({ select: { id: true, courseId: true } });

  if (enrollments.length === 0) {
    return {
      totalXP: 0,
      level: 1,
      levelName: levelProgress(0).levelName,
      emoji: levelProgress(0).emoji,
      percent: 0,
      xpForNextLevel: levelProgress(0).xpForNextLevel,
      nextLevelName: levelProgress(0).nextLevelName,
      streak: 0,
      longestStreak: 0,
      badges: [],
      leaderboard: [],
      recentXP: [],
    };
  }

  const studentIds = enrollments.map((enrollment) => enrollment.id);
  const courseId = enrollments[0].courseId;

  const [stats, earned, xpRows, leaderboard] = await Promise.all([
    db.studentStats.findMany({ where: { studentId: { in: studentIds } } }),
    db.achievement.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { earnedAt: "desc" },
    }),
    db.xPLog.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    leaderboardForCourse(courseId, 10),
  ]);

  const totalXP = stats.reduce((sum, stat) => sum + stat.totalXP, 0);
  const streak = stats.reduce((max, stat) => Math.max(max, stat.currentStreak), 0);
  const longest = stats.reduce((max, stat) => Math.max(max, stat.longestStreak), 0);
  const progress = levelProgress(totalXP);

  const badges = earned.map((row) => {
    const def = badgeCatalog[row.badge as BadgeKey];

    return def
      ? {
          key: row.badge,
          label: def.label,
          description: def.description,
          emoji: def.emoji,
          earnedAt: row.earnedAt.toISOString(),
        }
      : {
          key: row.badge,
          label: row.badge,
          description: "",
          emoji: "🏅",
          earnedAt: row.earnedAt.toISOString(),
        };
  });

  // TOP_WEEKLY depends on a live ranking rather than a stored event, so it is
  // derived here instead of being written to Achievement.
  if (leaderboard[0] && studentIds.includes(leaderboard[0].studentId)) {
    const key = "TOP_WEEKLY";

    if (!badges.some((badge) => badge.key === key)) {
      const def = badgeCatalog[key];
      badges.unshift({
        key,
        label: def.label,
        description: def.description,
        emoji: def.emoji,
        earnedAt: new Date().toISOString(),
      });
    }
  }

  return {
    totalXP,
    level: progress.level,
    levelName: progress.levelName,
    emoji: progress.emoji,
    percent: progress.percent,
    xpForNextLevel: progress.xpForNextLevel,
    nextLevelName: progress.nextLevelName,
    streak,
    longestStreak: longest,
    badges,
    leaderboard,
    recentXP: xpRows.map((row) => ({
      id: row.id,
      action: row.action,
      points: row.points,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
    })),
    ...(await childBreakdown(user)),
  };
}

/**
 * Per-child XP for parents. The aggregate fields above sum every child, which is
 * not meaningful on its own, so the parent screens need this breakdown.
 */
async function childBreakdown(user: MobileUser) {
  if (user.role !== "PARENT") {
    return {};
  }

  const children = await db.student.findMany({
    where: { parent: { userId: user.id } },
    select: {
      id: true,
      user: { select: { name: true } },
      course: { select: { name: true } },
    },
  });

  if (children.length === 0) {
    return { children: [] };
  }

  const ids = children.map((child) => child.id);
  const [stats, earned] = await Promise.all([
    db.studentStats.findMany({ where: { studentId: { in: ids } } }),
    db.achievement.findMany({ where: { studentId: { in: ids } } }),
  ]);

  return {
    children: children.map((child) => {
      const childStats = stats.find((row) => row.studentId === child.id);
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
        xpForNextLevel: progress.xpForNextLevel,
        currentStreak: childStats?.currentStreak ?? 0,
        longestStreak: childStats?.longestStreak ?? 0,
        badges: earned
          .filter((row) => row.studentId === child.id)
          .map((row) => {
            const def = badgeCatalog[row.badge as BadgeKey];

            return {
              key: row.badge,
              label: def?.label ?? row.badge,
              description: def?.description ?? "",
              emoji: def?.emoji ?? "🏅",
            };
          }),
      };
    }),
  };
}

export { evaluateBadges };