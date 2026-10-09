"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import {
  createAuditLogData,
  getRequestContext,
} from "@/lib/audit";
import { getDayOfWeekInTashkent, getTodayDateInput } from "@/lib/date";
import { db } from "@/lib/db";
import { sanitizeText } from "@/lib/sanitize";

const idSchema = z.string().min(1).max(100);

const courseDateSchema = z.object({
  courseId: idSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const attendanceStatusSchema = z.enum(["PRESENT", "ABSENT", "LATE"]);
const scoreSchema = z.coerce.number().min(0).max(100);

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function isRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? sanitizeText(value, 500) : "";
}

function parseId(value: string, path: string) {
  const parsed = idSchema.safeParse(value);

  if (!parsed.success) {
    fail(path, "Invalid record identifier.");
  }

  return parsed.data;
}

async function requireCourse(courseId: string) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const course = await db.course.findUnique({
    where: { id: courseId },
    include: { teacher: { select: { userId: true } } },
  });

  if (!course) {
    fail("/teacher", "Course not found.");
  }

  if (session.user.role === "TEACHER" && course.teacher.userId !== session.user.id) {
    redirect("/unauthorized");
  }

  return { course, session };
}

function assertNotFuture(date: string, path: string) {
  if (date > getTodayDateInput()) {
    fail(path, "The selected date cannot be in the future.");
  }
}

function finish(
  path: string,
  query: Record<string, string>,
  message: string,
): never {
  const searchParams = new URLSearchParams({
    ...query,
    success: message,
  });
  revalidatePath(path);
  redirect(`${path}?${searchParams.toString()}`);
}

export async function saveAttendance(formData: FormData): Promise<never> {
  const parsed = courseDateSchema.safeParse({
    courseId: formData.get("courseId"),
    date: formData.get("date"),
  });

  if (!parsed.success) {
    fail("/teacher/attendance", "Select a valid course and date.");
  }

  const path = "/teacher/attendance";
  assertNotFuture(parsed.data.date, path);
  const { course, session } = await requireCourse(parsed.data.courseId);
  const rawScheduleId = readText(formData, "scheduleId");
  const scheduleId = rawScheduleId ? parseId(rawScheduleId, path) : "";
  const schedule = scheduleId
    ? await db.schedule.findUnique({
        where: { id: scheduleId },
        select: { id: true, courseId: true, dayOfWeek: true },
      })
    : null;

  if (
    !schedule ||
    schedule.courseId !== course.id ||
    schedule.dayOfWeek !== getDayOfWeekInTashkent(
      new Date(`${parsed.data.date}T00:00:00.000Z`),
    )
  ) {
    fail(path, "No matching class is scheduled for that course and date.");
  }

  const students = await db.student.findMany({
    where: { courseId: course.id },
    select: { id: true },
  });

  if (students.length === 0) {
    fail(path, "This course has no enrolled students.");
  }

  const statuses = students.map((student) => {
    const status = attendanceStatusSchema.safeParse(
      readText(formData, `status:${student.id}`),
    );

    if (!status.success) {
      fail(path, "Choose Present, Absent, or Late for every student.");
    }

    return { studentId: student.id, status: status.data };
  });

  try {
    const context = getRequestContext();

    await db.$transaction(async (transaction) => {
      for (const entry of statuses) {
        await transaction.attendance.upsert({
          where: {
            studentId_scheduleId_date: {
              studentId: entry.studentId,
              scheduleId: schedule.id,
              date: new Date(`${parsed.data.date}T00:00:00.000Z`),
            },
          },
          create: {
            studentId: entry.studentId,
            scheduleId: schedule.id,
            date: new Date(`${parsed.data.date}T00:00:00.000Z`),
            status: entry.status,
          },
          update: { status: entry.status },
        });
      }

      await transaction.auditLog.create({
        data: createAuditLogData({
          userId: session.user.id,
          action: "ATTENDANCE_SAVE",
          entity: "Attendance",
          entityId: schedule.id,
          context,
          newValue: {
            courseId: course.id,
            date: parsed.data.date,
            statuses: Object.fromEntries(
              statuses.map((entry) => [entry.studentId, entry.status]),
            ),
          },
        }),
      });
    });

    finish(
      path,
      { courseId: course.id, date: parsed.data.date },
      "Attendance saved successfully.",
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    fail(path, "Attendance could not be saved. Please try again.");
  }
}

export async function saveGrades(formData: FormData): Promise<never> {
  const parsed = courseDateSchema.safeParse({
    courseId: formData.get("courseId"),
    date: formData.get("date"),
  });

  if (!parsed.success) {
    fail("/teacher/grades", "Select a valid course and date.");
  }

  const path = "/teacher/grades";
  assertNotFuture(parsed.data.date, path);
  const { course, session } = await requireCourse(parsed.data.courseId);
  const students = await db.student.findMany({
    where: { courseId: course.id },
    select: { id: true },
  });

  if (students.length === 0) {
    fail(path, "This course has no enrolled students.");
  }

  const existingGrades = await db.grade.findMany({
    where: { courseId: course.id, studentId: { in: students.map(({ id }) => id) } },
    orderBy: { date: "desc" },
    select: { id: true, studentId: true, score: true, comment: true },
  });
  const latestGradeByStudent = new Map<string, (typeof existingGrades)[number]>();
  for (const grade of existingGrades) {
    if (!latestGradeByStudent.has(grade.studentId)) {
      latestGradeByStudent.set(grade.studentId, grade);
    }
  }

  const entries = students.map((student) => {
    const score = scoreSchema.safeParse(readText(formData, `score:${student.id}`));
    if (!score.success) {
      fail(path, "Enter a score between 0 and 100 for every student.");
    }

    const rawGradeId = readText(formData, `gradeId:${student.id}`);
    const gradeId = rawGradeId ? parseId(rawGradeId, path) : "";
    const existingGrade = gradeId
      ? latestGradeByStudent.get(student.id)
      : undefined;

    if (gradeId && (!existingGrade || existingGrade.id !== gradeId)) {
      fail(path, "One of the grade records is no longer valid.");
    }

    return {
      studentId: student.id,
      gradeId: existingGrade?.id,
      score: score.data,
      comment: readText(formData, `comment:${student.id}`),
      existingGrade,
    };
  });

  try {
    const context = getRequestContext();
    const gradeDate = new Date(`${parsed.data.date}T00:00:00.000Z`);

    await db.$transaction(async (transaction) => {
      for (const entry of entries) {
        const grade = entry.gradeId
          ? await transaction.grade.update({
              where: { id: entry.gradeId },
              data: {
                score: entry.score,
                comment: entry.comment || null,
                date: gradeDate,
              },
            })
          : await transaction.grade.create({
              data: {
                studentId: entry.studentId,
                courseId: course.id,
                score: entry.score,
                comment: entry.comment || null,
                date: gradeDate,
              },
            });

        await transaction.auditLog.create({
          data: createAuditLogData({
            userId: session.user.id,
            action: entry.gradeId ? "GRADE_UPDATE" : "GRADE_CREATE",
            entity: "Grade",
            entityId: grade.id,
            context,
            oldValue: entry.existingGrade
              ? {
                  score: entry.existingGrade.score.toString(),
                  comment: entry.existingGrade.comment,
                }
              : undefined,
            newValue: {
              courseId: course.id,
              score: grade.score.toString(),
              comment: grade.comment,
              date: grade.date.toISOString(),
            },
          }),
        });
      }
    });

    finish(
      path,
      { courseId: course.id, date: parsed.data.date },
      "Grades saved successfully.",
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    fail(path, "Grades could not be saved. Please try again.");
  }
}
