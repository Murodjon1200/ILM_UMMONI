import { z } from "zod";

import { awardStreakBonuses, evaluateBadges } from "@/lib/achievements";
import { createAuditLogData, getRequestContext } from "@/lib/audit";
import { notifyParents } from "@/lib/parent-notifications";
import { sendPushToStudent, sendPushToStudentParents } from "@/lib/push";
import { getDayOfWeekInTashkent, getTodayDateInput } from "@/lib/date";
import { db } from "@/lib/db";
import { badRequest, forbidden, notFound } from "@/lib/mobile/api-error";
import type { MobileUser } from "@/lib/mobile/session";
import { sanitizeText } from "@/lib/sanitize";
import { attendancePoints, awardXp, gradePoints, refreshStreak } from "@/lib/xp";

/**
 * XP is awarded after the attendance transaction has committed, and failures are
 * swallowed: gamification must never make a teacher's save fail. Awards are
 * idempotent through XPLog.sourceKey, so a retried save cannot pay out twice.
 */
async function settleGamification(saved: number) {
  if (saved === 0) {
    return;
  }

  const rows = await db.attendance.findMany({
    orderBy: { date: "desc" },
    take: saved,
    select: {
      id: true,
      date: true,
      status: true,
      studentId: true,
      schedule: { select: { courseId: true } },
      student: { select: { user: { select: { name: true } } } },
    },
  });

  for (const row of rows) {
    await awardXp({
      studentId: row.studentId,
      action: "ATTENDANCE",
      points: attendancePoints(row.status),
      description:
        row.status === "PRESENT"
          ? "Darsga qatnashdi"
          : row.status === "LATE"
            ? "Darsga kechikdi"
            : "Davomat qayd etildi",
      sourceKey: `attendance:${row.id}`,
    });

    if (row.status === "ABSENT") {
      const studentName = row.student.user.name;

      await notifyParents({
        studentIds: [row.studentId],
        type: "ABSENCE",
        severity: "danger",
        title: (name) => `${name}: darsga kelmadi`,
        body: (name) => `${name} amaldagi darsda ishtirok etmadi.`,
      });

      await sendPushToStudentParents(row.studentId, {
        title: `${studentName}: darsga kelmadi`,
        body: `${studentName} amaldagi darsda ishtirok etmadi.`,
        data: { type: "ATTENDANCE" },
      });
    }

    const stats = await refreshStreak(row.studentId);
    await awardStreakBonuses(row.studentId, stats.longestStreak);

    const granted = await evaluateBadges(row.studentId);

    if (granted.length > 0) {
      const studentName = row.student.user.name;

      await notifyParents({
        studentIds: [row.studentId],
        type: "BADGE",
        severity: "info",
        title: (name) => `${name}: yangi yutuq`,
        body: (name) => `${name} yangi belgi qozondi (${granted.join(", ")}).`,
      });

      await sendPushToStudent(row.studentId, {
        title: "Yangi yutuq! 🏆",
        body: `${studentName}, siz yangi nishon qozondingiz: ${granted.join(", ")}.`,
        data: { type: "BADGE" },
      });
    }
  }
}

async function settleGradeGamification(
  studentId: string,
  gradeId: string,
  score: number,
) {
  await awardXp({
    studentId,
    action: "GRADE",
    points: gradePoints(score),
    description: `Baholandi: ${score}`,
    sourceKey: `grade:${gradeId}`,
  });

  await evaluateBadges(studentId);

  await notifyParents({
    studentIds: [studentId],
    type: "GRADE",
    severity: score < 50 ? "danger" : "info",
    title: () => "Yangi baho qo'yildi",
    body: () => `Baho: ${score}${score < 50 ? " — natijani ko'rib chiqish tavsiya etiladi." : ""}`,
  });

  await Promise.all([
    sendPushToStudent(studentId, {
      title: "Yangi baho qo'yildi",
      body: `Bahongiz: ${score} ball.`,
      data: { type: "GRADE" },
    }),
    sendPushToStudentParents(studentId, {
      title: "Farzandingiz baho oldi",
      body: `Yangi baho: ${score} ball.`,
      data: { type: "GRADE" },
    }),
  ]);
}

const idSchema = z.string().min(1).max(100);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");

const attendanceBodySchema = z.object({
  scheduleId: idSchema,
  date: dateSchema,
  records: z
    .array(
      z.object({
        studentId: idSchema,
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      }),
    )
    .min(1)
    .max(200),
});

const gradeBodySchema = z.object({
  gradeId: idSchema.optional(),
  studentId: idSchema,
  courseId: idSchema,
  score: z.coerce.number().min(0).max(100),
  comment: z.string().max(500).default(""),
  date: dateSchema,
});

function toDateInput(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function assertNotFuture(date: string) {
  if (date > getTodayDateInput()) {
    throw badRequest("The selected date cannot be in the future.");
  }
}

async function requireOwnedCourse(user: MobileUser, courseId: string) {
  if (user.role !== "ADMIN" && user.role !== "TEACHER") {
    throw forbidden();
  }

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, teacher: { select: { userId: true } } },
  });

  if (!course) {
    throw notFound("Course not found.");
  }

  if (user.role === "TEACHER" && course.teacher.userId !== user.id) {
    throw forbidden();
  }

  return course;
}

export async function saveAttendance(user: MobileUser, body: unknown) {
  const parsed = attendanceBodySchema.safeParse(body);

  if (!parsed.success) {
    throw badRequest("Choose a class, a date, and a status for every student.");
  }

  const { scheduleId, date, records } = parsed.data;
  assertNotFuture(date);

  const schedule = await db.schedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, courseId: true, dayOfWeek: true },
  });

  if (!schedule) {
    throw notFound("Class not found.");
  }

  if (schedule.dayOfWeek !== getDayOfWeekInTashkent(toDateInput(date))) {
    throw badRequest("No matching class is scheduled for that date.");
  }

  const course = await requireOwnedCourse(user, schedule.courseId);

  const students = await db.student.findMany({
    where: { courseId: course.id },
    select: { id: true },
  });

  const enrolledIds = new Set(students.map(({ id }) => id));
  const uniqueRecords = new Map<string, (typeof records)[number]>();

  for (const record of records) {
    if (!enrolledIds.has(record.studentId)) {
      throw badRequest("One of the students is not enrolled in this course.");
    }

    uniqueRecords.set(record.studentId, record);
  }

  const dateValue = toDateInput(date);
  const context = getRequestContext();

  await db.$transaction(async (transaction) => {
    for (const record of uniqueRecords.values()) {
      await transaction.attendance.upsert({
        where: {
          studentId_scheduleId_date: {
            studentId: record.studentId,
            scheduleId: schedule.id,
            date: dateValue,
          },
        },
        create: {
          studentId: record.studentId,
          scheduleId: schedule.id,
          date: dateValue,
          status: record.status,
        },
        update: { status: record.status },
      });
    }

    await transaction.auditLog.create({
      data: createAuditLogData({
        userId: user.id,
        action: "ATTENDANCE_SAVE_MOBILE",
        entity: "Attendance",
        entityId: schedule.id,
        context,
        newValue: {
          courseId: course.id,
          date,
          statuses: Object.fromEntries(
            [...uniqueRecords].map(([studentId, record]) => [
              studentId,
              record.status,
            ]),
          ),
        },
      }),
    });
  });

  await settleGamification(uniqueRecords.size);

  return { saved: uniqueRecords.size };
}

export async function saveGrade(user: MobileUser, body: unknown) {
  const parsed = gradeBodySchema.safeParse(body);

  if (!parsed.success) {
    throw badRequest("Enter a score between 0 and 100 for an enrolled student.");
  }

  const data = parsed.data;
  assertNotFuture(data.date);
  const course = await requireOwnedCourse(user, data.courseId);

  const enrollment = await db.student.findUnique({
    where: { id: data.studentId },
    select: { id: true, courseId: true },
  });

  if (!enrollment || enrollment.courseId !== course.id) {
    throw badRequest("Student is not enrolled in this course.");
  }

  const comment = data.comment ? sanitizeText(data.comment, 500) : null;
  const gradeDate = toDateInput(data.date);
  const context = getRequestContext();

  if (data.gradeId) {
    const existingGrade = await db.grade.findUnique({
      where: { id: data.gradeId },
      select: { id: true, courseId: true, score: true, comment: true },
    });

    if (!existingGrade || existingGrade.courseId !== course.id) {
      throw notFound("Grade record not found.");
    }

    const grade = await db.$transaction(async (transaction) => {
      const updated = await transaction.grade.update({
        where: { id: existingGrade.id },
        data: { score: data.score, comment, date: gradeDate },
      });

      await transaction.auditLog.create({
        data: createAuditLogData({
          userId: user.id,
          action: "GRADE_UPDATE_MOBILE",
          entity: "Grade",
          entityId: updated.id,
          context,
          oldValue: {
            score: existingGrade.score.toString(),
            comment: existingGrade.comment,
          },
          newValue: {
            courseId: course.id,
            score: updated.score.toString(),
            comment: updated.comment,
          },
        }),
      });

      return updated;
    });

    // XP, badges and push run after the transaction commits so slow network
    // calls never hold the database transaction open.
    await settleGradeGamification(
      data.studentId,
      grade.id,
      Number(grade.score),
    );

    return { id: grade.id, score: Number(grade.score), updated: true };
  }

  const grade = await db.$transaction(async (transaction) => {
    const created = await transaction.grade.create({
      data: {
        studentId: data.studentId,
        courseId: course.id,
        score: data.score,
        comment,
        date: gradeDate,
      },
    });

    await transaction.auditLog.create({
      data: createAuditLogData({
        userId: user.id,
        action: "GRADE_CREATE_MOBILE",
        entity: "Grade",
        entityId: created.id,
        context,
        newValue: {
          studentId: created.studentId,
          courseId: created.courseId,
          score: created.score.toString(),
          date: created.date.toISOString(),
        },
      }),
    });

    return created;
  });

  await settleGradeGamification(
    data.studentId,
    grade.id,
    Number(grade.score),
  );

  return { id: grade.id, score: Number(grade.score), updated: false };
}
