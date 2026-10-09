import { getTranslations } from "next-intl/server";

import {
  badgeCatalog,
  type BadgeKey,
  leaderboardForCourse,
} from "@/lib/achievements";
import { db } from "@/lib/db";
import { levelProgress } from "@/lib/xp";

/**
 * XP panel for the student dashboard: level progress, streak, badges and the
 * course leaderboard. Reads only; XP is granted by the write paths.
 */
export async function GamificationPanel({ studentIds }: { studentIds: string[] }) {
  const t = await getTranslations("gamification");

  if (studentIds.length === 0) {
    return null;
  }

  const courseId = await db.student.findFirst({
    where: { id: { in: studentIds } },
    select: { courseId: true },
  });

  const [stats, earned, leaderboard] = await Promise.all([
    db.studentStats.findMany({ where: { studentId: { in: studentIds } } }),
    db.achievement.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { earnedAt: "desc" },
    }),
    courseId ? leaderboardForCourse(courseId.courseId, 10) : Promise.resolve([]),
  ]);

  const totalXP = stats.reduce((sum, stat) => sum + stat.totalXP, 0);
  const streak = stats.reduce((max, stat) => Math.max(max, stat.currentStreak), 0);
  const longest = stats.reduce((max, stat) => Math.max(max, stat.longestStreak), 0);
  const progress = levelProgress(totalXP);

  const badges = earned.map((row) => {
    const def = badgeCatalog[row.badge as BadgeKey];

    return {
      key: row.badge,
      label: def?.label ?? row.badge,
      description: def?.description ?? "",
      emoji: def?.emoji ?? "🏅",
    };
  });

  if (leaderboard[0] && studentIds.includes(leaderboard[0].studentId)) {
    const def = badgeCatalog.TOP_WEEKLY;

    if (!badges.some((badge) => badge.key === "TOP_WEEKLY")) {
      badges.unshift({
        key: "TOP_WEEKLY",
        label: def.label,
        description: def.description,
        emoji: def.emoji,
      });
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
          {t("eyebrow")}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              {progress.emoji} {progress.levelName}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("level")} {progress.level} · {progress.totalXP} XP
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-orange-500">🔥 {streak}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("best")}: {longest}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {progress.xpForNextLevel === null
              ? t("maxLevel")
              : t("toNext", {
                  count: progress.xpForNextLevel,
                  name: progress.nextLevelName ?? "",
                })}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-950 dark:text-white">
            {t("badges")}
          </h3>
          {badges.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              {t("noBadges")}
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {badges.map((badge) => (
                <li
                  key={badge.key}
                  className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4"
                >
                  <p className="text-2xl">{badge.emoji}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                    {badge.label}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {badge.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-950 dark:text-white">
            {t("leaderboard")}
          </h3>
          {leaderboard.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              {t("noRank")}
            </p>
          ) : (
            <ol className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {leaderboard.map((row) => {
                const isMe = studentIds.includes(row.studentId);

                return (
                  <li
                    key={row.studentId}
                    className="flex items-center justify-between py-3 text-sm"
                  >
                    <span
                      className={
                        isMe
                          ? "font-semibold text-brand-600 dark:text-brand-400"
                          : "text-slate-700 dark:text-slate-300"
                      }
                    >
                      {row.rank}. {row.name}
                      {isMe ? ` (${t("you")})` : ""}
                    </span>
                    <span className="font-semibold text-slate-950 dark:text-white">
                      {row.totalXP} XP
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}