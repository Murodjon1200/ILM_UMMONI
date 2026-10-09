import { evaluateBadges } from "@/lib/achievements";
import { hash } from "bcryptjs";
import { z } from "zod";

import { createAuditLogData, getRequestContext } from "@/lib/audit";
import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/mobile/api-error";
import { notifyParents } from "@/lib/parent-notifications";
import { phoneSchema } from "@/lib/phone";
import { isStrongPassword } from "@/lib/password";
import { sendPushToStudent, sendPushToStudentParents } from "@/lib/push";
import { sanitizeText } from "@/lib/sanitize";
import { awardXp, xpRules } from "@/lib/xp";

const idSchema = z.string().min(1).max(100);
const optionalEmailSchema = z
  .union([z.string().trim().email(), z.literal("")])
  .optional()
  .default("");

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Use a HH:MM time.")
  .transform((value) => {
    const [hours, minutes] = value.split(":").map(Number);
    return new Date(Date.UTC(1970, 0, 1, hours, minutes));
  });

const studentBodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: optionalEmailSchema,
  phone: phoneSchema,
  password: z.string().min(1).max(72),
  courseId: idSchema,
  startDate: dateSchema,
  status: z.enum(["ACTIVE", "INACTIVE", "COMPLETED", "SUSPENDED"]),
});

const studentUpdateSchema = studentBodySchema.partial().omit({ password: true }).extend({
  password: z.string().min(1).max(72).optional(),
});

const teacherBodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: optionalEmailSchema,
  phone: phoneSchema,
  password: z.string().min(1).max(72),
  subject: z.string().trim().min(2).max(100),
  bio: z.string().max(500).default(""),
});

const courseBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(1000).default(""),
  price: z.coerce.number().min(0).max(100000000),
  duration: z.coerce.number().int().min(1).max(10000),
  teacherId: idSchema,
});

const paymentBodySchema = z.object({
  studentId: idSchema,
  amount: z.coerce.number().positive().max(1000000000),
  date: dateSchema,
  status: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "OTHER"]),
});

const scheduleBodySchema = z.object({
  courseId: idSchema,
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  startTime: timeSchema,
  endTime: timeSchema,
  room: z.string().trim().min(1).max(50),
});

const applicationStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

function text(value: string, max: number) {
  return sanitizeText(value, max) || null;
}

async function createReceiptNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const { randomBytes } = await import("node:crypto");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const receiptNumber = `RCP-${date}-${randomBytes(5).toString("hex").toUpperCase()}`;
    const existing = await db.payment.findUnique({
      where: { receiptNumber },
      select: { id: true },
    });

    if (!existing) {
      return receiptNumber;
    }
  }

  throw new Error("Receipt number generation failed");
}

export async function createStudent(
  actorId: string,
  body: unknown,
): Promise<{ id: string; userId: string; created: boolean }> {
  const parsed = studentBodySchema.safeParse(body);

  if (!parsed.success) {
    throw badRequest("Please check the student details.");
  }

  const data = parsed.data;

  if (!isStrongPassword(data.password)) {
    throw badRequest("Use a strong password with at least 12 characters.");
  }

  const existingUser = await db.user.findUnique({ where: { phone: data.phone } });

  if (existingUser && existingUser.role !== "STUDENT") {
    throw badRequest("That phone number belongs to a different role.");
  }

  if (existingUser) {
    const existing = await db.student.findUnique({
      where: { userId_courseId: { userId: existingUser.id, courseId: data.courseId } },
      select: { id: true },
    });

    if (existing) {
      throw badRequest("This student is already enrolled in that course.");
    }
  }

  const course = await db.course.findUnique({
    where: { id: data.courseId },
    select: { id: true },
  });

  if (!course) {
    throw notFound("Course not found.");
  }

  const context = getRequestContext();
  const passwordHash = await hash(data.password, 12);

  const result = await db.$transaction(async (transaction) => {
    const user = existingUser
      ? await transaction.user.update({
          where: { id: existingUser.id },
          data: { name: data.name, phone: data.phone },
        })
      : await transaction.user.create({
          data: {
            name: data.name,
            email: data.email || null,
            phone: data.phone,
            password: passwordHash,
            role: "STUDENT",
          },
        });

    const student = await transaction.student.create({
      data: {
        userId: user.id,
        courseId: data.courseId,
        startDate: data.startDate,
        status: data.status,
      },
    });

    await transaction.auditLog.create({
      data: createAuditLogData({
        userId: actorId,
        action: "STUDENT_ADD_MOBILE",
        entity: "Student",
        entityId: student.id,
        context,
        newValue: {
          name: data.name,
          email: data.email || null,
          courseId: data.courseId,
          status: data.status,
        },
      }),
    });

    return { id: student.id, userId: user.id, created: !existingUser };
  });

  return result;
}

export async function updateStudent(
  actorId: string,
  studentId: string,
  body: unknown,
) {
  const parsed = studentUpdateSchema.safeParse(body);

  if (!parsed.success) {
    throw badRequest("Please check the student details.");
  }

  const data = parsed.data;

  if (data.password && !isStrongPassword(data.password)) {
    throw badRequest("Use a strong password with at least 12 characters.");
  }

  const enrollment = await db.student.findUnique({
    where: { id: idSchema.parse(studentId) },
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
  });

  if (!enrollment) {
    throw notFound("Student record not found.");
  }

  if (data.phone && data.phone !== enrollment.user.phone) {
    const owner = await db.user.findFirst({
      where: { phone: data.phone, id: { not: enrollment.userId } },
      select: { id: true },
    });

    if (owner) {
      throw badRequest("That phone number is already in use.");
    }
  }

  if (data.email) {
    const owner = await db.user.findFirst({
      where: { email: data.email, id: { not: enrollment.userId } },
      select: { id: true },
    });

    if (owner) {
      throw badRequest("That email is already in use.");
    }
  }

  const context = getRequestContext();
  const passwordHash = data.password ? await hash(data.password, 12) : null;

  const updated = await db.$transaction(async (transaction) => {
    const student = await transaction.student.update({
      where: { id: enrollment.id },
      data: {
        ...(data.courseId ? { courseId: data.courseId } : {}),
        ...(data.startDate ? { startDate: data.startDate } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });

    await transaction.user.update({
      where: { id: enrollment.userId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email || null } : {}),
        ...(data.phone ? { phone: data.phone } : {}),
        ...(passwordHash ? { password: passwordHash } : {}),
      },
    });

    await transaction.auditLog.create({
      data: createAuditLogData({
        userId: actorId,
        action: "STUDENT_UPDATE_MOBILE",
        entity: "Student",
        entityId: student.id,
        context,
        oldValue: {
          name: enrollment.user.name,
          email: enrollment.user.email,
          courseId: enrollment.courseId,
          status: enrollment.status,
        },
        newValue: {
          name: data.name ?? enrollment.user.name,
          courseId: data.courseId ?? enrollment.courseId,
          status: data.status ?? enrollment.status,
          passwordChanged: Boolean(passwordHash),
        },
      }),
    });

    return student;
  });

  return { id: updated.id };
}

export async function createTeacher(actorId: string, body: unknown) {
  const parsed = teacherBodySchema.safeParse(body);

  if (!parsed.success) {
    throw badRequest("Please check the teacher details.");
  }

  const data = parsed.data;

  if (!isStrongPassword(data.password)) {
    throw badRequest("Use a strong password with at least 12 characters.");
  }

  const existing = await db.user.findUnique({ where: { phone: data.phone } });

  if (existing) {
    throw badRequest("A user with that phone number already exists.");
  }

  const context = getRequestContext();
  const passwordHash = await hash(data.password, 12);

  return db.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone,
        password: passwordHash,
        role: "TEACHER",
      },
    });

    const teacher = await transaction.teacher.create({
      data: {
        userId: user.id,
        subject: data.subject,
        bio: text(data.bio, 500),
      },
    });

    await transaction.auditLog.create({
      data: createAuditLogData({
        userId: actorId,
        action: "TEACHER_ADD_MOBILE",
        entity: "Teacher",
        entityId: teacher.id,
        context,
        newValue: { name: data.name, email: data.email || null, subject: data.subject },
      }),
    });

    return { id: teacher.id, userId: user.id };
  });
}

export async function createCourse(actorId: string, body: unknown) {
  const parsed = courseBodySchema.safeParse(body);

  if (!parsed.success) {
    throw badRequest("Please check the course details.");
  }

  const data = parsed.data;
  const teacher = await db.teacher.findUnique({
    where: { id: data.teacherId },
    select: { id: true },
  });

  if (!teacher) {
    throw badRequest("Select an existing teacher.");
  }

  const context = getRequestContext();

  return db.$transaction(async (transaction) => {
    const course = await transaction.course.create({
      data: {
        name: data.name,
        description: text(data.description, 1000),
        price: data.price,
        duration: data.duration,
        teacherId: data.teacherId,
      },
    });

    await transaction.auditLog.create({
      data: createAuditLogData({
        userId: actorId,
        action: "COURSE_ADD_MOBILE",
        entity: "Course",
        entityId: course.id,
        context,
        newValue: {
          name: data.name,
          price: data.price,
          duration: data.duration,
          teacherId: data.teacherId,
        },
      }),
    });

    return { id: course.id };
  });
}

export async function createPayment(actorId: string, body: unknown) {
  const parsed = paymentBodySchema.safeParse(body);

  if (!parsed.success) {
    throw badRequest("Please check the payment details.");
  }

  const data = parsed.data;
  const student = await db.student.findUnique({
    where: { id: data.studentId },
    select: { id: true },
  });

  if (!student) {
    throw notFound("Student enrollment not found.");
  }

  const receiptNumber = await createReceiptNumber();
  const context = getRequestContext();

  return db.$transaction(async (transaction) => {
    const payment = await transaction.payment.create({
      data: {
        receiptNumber,
        studentId: data.studentId,
        amount: data.amount,
        date: data.date,
        status: data.status,
        method: data.method,
      },
    });

    await transaction.auditLog.create({
      data: createAuditLogData({
        userId: actorId,
        action: "PAYMENT_CREATE_MOBILE",
        entity: "Payment",
        entityId: payment.id,
        context,
        newValue: {
          receiptNumber,
          studentId: data.studentId,
          amount: payment.amount.toString(),
          status: data.status,
          method: data.method,
        },
      }),
    });

await settlePaymentGamification(
      data.studentId,
      payment.id,
      payment.amount.toString(),
      payment.status,
    );

    return { id: payment.id, receiptNumber };
    });
}

async function settlePaymentGamification(
  studentId: string,
  paymentId: string,
  amount: string,
  status: string,
) {
  if (status !== "PAID") {
    return;
  }

  await awardXp({
    studentId,
    action: "PAYMENT",
    points: xpRules.paymentOnTime,
    description: `To'lov qabul qilindi: ${amount}`,
    sourceKey: `payment:${paymentId}`,
  });

  await evaluateBadges(studentId);
}

export async function createSchedule(actorId: string, body: unknown) {
  const parsed = scheduleBodySchema.safeParse(body);

  if (!parsed.success) {
    throw badRequest("Please check the schedule details.");
  }

  const data = parsed.data;

  if (data.endTime <= data.startTime) {
    throw badRequest("The end time must be after the start time.");
  }

  const course = await db.course.findUnique({
    where: { id: data.courseId },
    select: { id: true, teacherId: true },
  });

  if (!course) {
    throw notFound("Course not found.");
  }

  const context = getRequestContext();

  return db.$transaction(async (transaction) => {
    const schedule = await transaction.schedule.create({
      data: {
        courseId: data.courseId,
        teacherId: course.teacherId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        room: data.room,
      },
    });

    await transaction.auditLog.create({
      data: createAuditLogData({
        userId: actorId,
        action: "SCHEDULE_ADD_MOBILE",
        entity: "Schedule",
        entityId: schedule.id,
        context,
        newValue: {
          courseId: data.courseId,
          dayOfWeek: data.dayOfWeek,
          room: data.room,
        },
      }),
    });

    return { id: schedule.id };
  });
}

export async function updateApplicationStatus(
  actorId: string,
  applicationId: string,
  body: unknown,
) {
  const parsed = applicationStatusSchema.safeParse(body);

  if (!parsed.success) {
    throw badRequest("Invalid application status.");
  }

  const id = idSchema.parse(applicationId);
  const application = await db.application.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!application) {
    throw notFound("Application not found.");
  }

  const context = getRequestContext();

  return db.$transaction(async (transaction) => {
    const updated = await transaction.application.update({
      where: { id },
      data: { status: parsed.data.status },
    });

    await transaction.auditLog.create({
      data: createAuditLogData({
        userId: actorId,
        action: "APPLICATION_STATUS_MOBILE",
        entity: "Application",
        entityId: updated.id,
        context,
        oldValue: { status: application.status },
        newValue: { status: updated.status },
      }),
    });

    return { id: updated.id, status: updated.status };
  });
}

export async function listApplications(limit = 100) {
  const rows = await db.application.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      createdAt: true,
      course: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    courseId: row.course.id,
    courseName: row.course.name,
  }));
}

export async function getAdminStats() {
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const [students, teachers, courses, applications, paid] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "TEACHER" } }),
    db.course.count(),
    db.application.count({ where: { status: "PENDING" } }),
    db.payment.aggregate({
      where: { status: "PAID" },
      _count: true,
      _sum: { amount: true },
    }),
  ]);

  const yearPaid = await db.payment.aggregate({
    where: { status: "PAID", date: { gte: yearStart } },
    _sum: { amount: true },
  });

  return {
    students,
    teachers,
    courses,
    pendingApplications: applications,
    paidPayments: paid._count,
    totalRevenue: Number(paid._sum.amount ?? 0),
    annualRevenue: Number(yearPaid._sum.amount ?? 0),
  } satisfies Record<string, number>;
}

export type AdminStats = Awaited<ReturnType<typeof getAdminStats>>;

const reminderBodySchema = z.object({
  studentId: idSchema,
  amount: z.coerce.number().positive().max(1000000000).optional(),
  note: z.string().max(300).optional().default(""),
});

/**
 * Admin-triggered payment reminder. Stores a durable parent notification, sends
 * a push to the student and the parent, and records an audit entry.
 */
export async function sendPaymentReminder(actorId: string, body: unknown) {
  const parsed = reminderBodySchema.safeParse(body);

  if (!parsed.success) {
    throw badRequest("Please check the reminder details.");
  }

  const { studentId, amount } = parsed.data;
  const note = parsed.data.note ? sanitizeText(parsed.data.note, 300) : "";

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      course: { select: { name: true } },
    },
  });

  if (!student) {
    throw notFound("Student enrollment not found.");
  }

  const amountText = amount
    ? `${amount.toLocaleString("uz-UZ")} so'm`
    : "belgilangan miqdor";
  const pushBody = `${student.course.name} kursi uchun to'lov (${amountText}) kutilmoqda.${
    note ? ` ${note}` : ""
  }`;

  await notifyParents({
    studentIds: [student.id],
    type: "PAYMENT",
    severity: "warning",
    title: () => "To'lov eslatmasi",
    body: () => pushBody,
  });

  await Promise.all([
    sendPushToStudent(student.id, {
      title: "To'lov eslatmasi",
      body: pushBody,
      data: { type: "PAYMENT" },
    }),
    sendPushToStudentParents(student.id, {
      title: "Farzandingiz uchun to'lov eslatmasi",
      body: pushBody,
      data: { type: "PAYMENT" },
    }),
  ]);

  const context = getRequestContext();

  await db.auditLog.create({
    data: createAuditLogData({
      userId: actorId,
      action: "PAYMENT_REMINDER_MOBILE",
      entity: "Student",
      entityId: student.id,
      context,
      newValue: { amount: amount ?? null, note: note || null },
    }),
  });

  return { studentId: student.id, sent: true };
}
