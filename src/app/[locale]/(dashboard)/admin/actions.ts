"use server";

import { randomBytes } from "node:crypto";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  isStrongPassword,
  optionalStrongPasswordSchema,
} from "@/lib/password";
import { phoneSchema } from "@/lib/phone";
import { sanitizeText } from "@/lib/sanitize";

const emailSchema = z
  .string()
  .trim()
  .email()
  .transform((email) => email.toLowerCase());

const idSchema = z.string().min(1).max(100);

const optionalEmailSchema = z
  .union([emailSchema, z.literal("")])
  .optional()
  .default("");

const studentSchema = z.object({
  studentId: idSchema.optional(),
  name: z.string().trim().min(2).max(80),
  email: optionalEmailSchema,
  phone: phoneSchema,
  password: optionalStrongPasswordSchema,
  courseId: idSchema,
  startDate: z.coerce.date(),
  status: z.enum(["ACTIVE", "INACTIVE", "COMPLETED", "SUSPENDED"]),
});

const teacherSchema = z.object({
  teacherId: idSchema.optional(),
  name: z.string().trim().min(2).max(80),
  email: optionalEmailSchema,
  phone: phoneSchema,
  password: optionalStrongPasswordSchema,
  subject: z.string().trim().min(2).max(100),
  bio: z.string().trim().max(500).default(""),
});

const courseSchema = z.object({
  courseId: idSchema.optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(""),
  price: z.coerce.number().min(0).max(100000000),
  duration: z.coerce.number().int().min(1).max(10000),
  teacherId: idSchema,
});

const applicationStatusSchema = z.enum(["APPROVED", "REJECTED"]);

const paymentCreateSchema = z.object({
  studentId: idSchema,
  amount: z.coerce.number().positive().max(1000000000),
  date: z.coerce.date(),
  status: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "OTHER"]),
});

const paymentStatusSchema = z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]);

const gradeSchema = z.object({
  gradeId: idSchema.optional(),
  studentId: idSchema,
  courseId: idSchema,
  score: z.coerce.number().min(0).max(100),
  comment: z.string().max(500).default(""),
  date: z.coerce.date(),
});

async function requireAdmin() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  return session;
}

async function requireStaff() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    redirect("/unauthorized");
  }

  return session;
}

async function requireCourseEditor(courseId: string, path: string) {
  const session = await requireStaff();
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: { teacher: { select: { userId: true } } },
  });

  if (!course) {
    fail(path, "Course not found.");
  }

  if (
    session.user.role === "TEACHER" &&
    course.teacher.userId !== session.user.id
  ) {
    redirect("/unauthorized");
  }

  return { course, session };
}

async function createReceiptNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const receiptNumber = `RCP-${date}-${randomBytes(5).toString("hex").toUpperCase()}`;
    const existingPayment = await db.payment.findUnique({
      where: { receiptNumber },
      select: { id: true },
    });

    if (!existingPayment) {
      return receiptNumber;
    }
  }

  throw new Error("Receipt number generation failed");
}

function parseForm<T>(schema: z.ZodType<T>, formData: FormData, path: string) {
  const rawValues = Object.fromEntries(formData);
  const sanitizedValues = Object.fromEntries(
    Object.entries(rawValues).map(([key, value]) => [
      key,
      key === "password" || typeof value !== "string"
        ? value
        : sanitizeText(value, 1000),
    ]),
  );
  const parsed = schema.safeParse(sanitizedValues);

  if (!parsed.success) {
    redirect(
      `${path}?error=${encodeURIComponent("Please check the form and try again.")}`,
    );
  }

  return parsed.data;
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function parseId(value: string, path: string) {
  const parsed = idSchema.safeParse(value);

  if (!parsed.success) {
    fail(path, "Invalid record identifier.");
  }

  return parsed.data;
}

function finish(path: string, message: string): never {
  revalidatePath(path);
  revalidatePath("/admin");
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

export async function createStudent(formData: FormData): Promise<never> {
  const session = await requireAdmin();

  const data = parseForm(studentSchema, formData, "/admin/students");
  const passwordValue = data.password ?? "";

  if (!isStrongPassword(passwordValue)) {
    fail("/admin/students", "Use a strong password with at least 12 characters.");
  }

  try {
    const existingUser = await db.user.findUnique({
      where: { phone: data.phone },
    });

    if (existingUser && existingUser.role !== "STUDENT") {
      fail("/admin/students", "That phone number belongs to a different role.");
    }

    if (existingUser) {
      const existingEnrollment = await db.student.findUnique({
        where: {
          userId_courseId: {
            userId: existingUser.id,
            courseId: data.courseId,
          },
        },
      });

      if (existingEnrollment) {
        fail("/admin/students", "This student is already enrolled in that course.");
      }
    }

    const passwordHash = await hash(passwordValue, 12);
    // Enrolling an already-registered student must not silently reset their
    // credential: a password change needs its own explicit action. Without this
    // the "Add student" form doubles as an undocumented password reset.
    const user = existingUser
      ? await db.user.update({
          where: { id: existingUser.id },
          data: {
            name: data.name,
            phone: data.phone,
          },
        })
      : await db.user.create({
          data: {
            name: data.name,
            email: data.email || null,
            phone: data.phone,
            password: passwordHash,
            role: "STUDENT",
          },
        });

    const student = await db.student.create({
      data: {
        userId: user.id,
        courseId: data.courseId,
        startDate: data.startDate,
        status: data.status,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "STUDENT_ADD",
      entity: "Student",
      entityId: student.id,
      newValue: {
        name: data.name,
        email: data.email || null,
        courseId: data.courseId,
        status: data.status,
      },
    });

    finish("/admin/students", "Student added successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) {
      throw error;
    }

    fail("/admin/students", "Student could not be added. Please try again.");
  }
}

export async function updateStudent(formData: FormData): Promise<never> {
  const session = await requireAdmin();

  const data = parseForm(studentSchema, formData, "/admin/students");

  if (!data.studentId) {
    fail("/admin/students", "Student record not found.");
  }

  if (data.password && !isStrongPassword(data.password)) {
    fail("/admin/students", "Use a strong password with at least 12 characters.");
  }

  const enrollment = await db.student.findUnique({
    where: { id: data.studentId },
    include: { user: true },
  });

  if (!enrollment) {
    fail("/admin/students", "Student record not found.");
  }

  const emailOwner = data.email
    ? await db.user.findFirst({
        where: {
          email: data.email,
          id: { not: enrollment.userId },
        },
      })
    : null;
  const phoneOwner = await db.user.findFirst({
    where: {
      phone: data.phone,
      id: { not: enrollment.userId },
    },
  });

  if (emailOwner) {
    fail("/admin/students", "That email is already in use.");
  }

  if (phoneOwner) {
    fail("/admin/students", "That phone number is already in use.");
  }

  try {
    const passwordHash = data.password
      ? await hash(data.password, 12)
      : undefined;

    await db.$transaction([
      db.user.update({
        where: { id: enrollment.userId },
        data: {
          name: data.name,
          email: data.email || null,
          phone: data.phone,
          ...(passwordHash ? { password: passwordHash } : {}),
        },
      }),
      db.student.update({
        where: { id: enrollment.id },
        data: {
          courseId: data.courseId,
          startDate: data.startDate,
          status: data.status,
        },
      }),
    ]);

    await writeAuditLog({
      userId: session.user.id,
      action: "STUDENT_UPDATE",
      entity: "Student",
      entityId: enrollment.id,
      oldValue: {
        name: enrollment.user.name,
        email: enrollment.user.email,
        courseId: enrollment.courseId,
        status: enrollment.status,
      },
      newValue: {
        name: data.name,
        email: data.email || null,
        courseId: data.courseId,
        status: data.status,
      },
    });

    finish("/admin/students", "Student updated successfully.");
  } catch {
    fail("/admin/students", "Student could not be updated. Please try again.");
  }
}

export async function deleteStudent(studentId: string): Promise<never> {
  const session = await requireAdmin();
  const studentRecordId = parseId(studentId, "/admin/students");

  const enrollment = await db.student.findUnique({
    where: { id: studentRecordId },
    include: {
      course: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!enrollment) {
    fail("/admin/students", "Student record not found.");
  }

  try {
    await db.$transaction(async (transaction) => {
      await transaction.student.delete({ where: { id: enrollment.id } });

      const remainingEnrollments = await transaction.student.count({
        where: { userId: enrollment.userId },
      });

      if (remainingEnrollments === 0) {
        await transaction.user.delete({ where: { id: enrollment.userId } });
      }
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "STUDENT_REMOVE",
      entity: "Student",
      entityId: enrollment.id,
      oldValue: {
        name: enrollment.user.name,
        email: enrollment.user.email,
        courseId: enrollment.courseId,
        courseName: enrollment.course.name,
        status: enrollment.status,
      },
    });

    finish("/admin/students", "Student deleted successfully.");
  } catch {
    fail("/admin/students", "Student could not be deleted. Please try again.");
  }
}

export async function createTeacher(formData: FormData): Promise<never> {
  const session = await requireAdmin();

  const data = parseForm(teacherSchema, formData, "/admin/teachers");
  const passwordValue = data.password ?? "";

  if (!isStrongPassword(passwordValue)) {
    fail("/admin/teachers", "Use a strong password with at least 12 characters.");
  }

  try {
    const existingUser = await db.user.findUnique({
      where: { phone: data.phone },
    });

    if (existingUser) {
      fail("/admin/teachers", "A user with that phone number already exists.");
    }

    const passwordHash = await hash(passwordValue, 12);

    const teacherId = await db.$transaction(async (transaction) => {
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
          bio: data.bio || null,
        },
      });

      return { teacherId: teacher.id, userId: user.id };
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "TEACHER_ADD",
      entity: "Teacher",
      entityId: teacherId.teacherId,
      newValue: { name: data.name, email: data.email || null, subject: data.subject },
    });

    finish("/admin/teachers", "Teacher added successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) {
      throw error;
    }

    fail("/admin/teachers", "Teacher could not be added. Please try again.");
  }
}

export async function updateTeacher(formData: FormData): Promise<never> {
  const session = await requireAdmin();

  const data = parseForm(teacherSchema, formData, "/admin/teachers");

  if (!data.teacherId) {
    fail("/admin/teachers", "Teacher record not found.");
  }

  const teacher = await db.teacher.findUnique({
    where: { id: data.teacherId },
    include: { user: true },
  });

  if (!teacher) {
    fail("/admin/teachers", "Teacher record not found.");
  }

  const emailOwner = data.email
    ? await db.user.findFirst({
        where: {
          email: data.email,
          id: { not: teacher.userId },
        },
      })
    : null;
  const phoneOwner = await db.user.findFirst({
    where: {
      phone: data.phone,
      id: { not: teacher.userId },
    },
  });

  if (emailOwner) {
    fail("/admin/teachers", "That email is already in use.");
  }

  if (phoneOwner) {
    fail("/admin/teachers", "That phone number is already in use.");
  }

  try {
    const passwordHash = data.password
      ? await hash(data.password, 12)
      : undefined;

    await db.$transaction([
      db.user.update({
        where: { id: teacher.userId },
        data: {
          name: data.name,
          email: data.email || null,
          phone: data.phone,
          ...(passwordHash ? { password: passwordHash } : {}),
        },
      }),
      db.teacher.update({
        where: { id: teacher.id },
        data: {
          subject: data.subject,
          bio: data.bio || null,
        },
      }),
    ]);

    await writeAuditLog({
      userId: session.user.id,
      action: "TEACHER_UPDATE",
      entity: "Teacher",
      entityId: teacher.id,
      oldValue: {
        name: teacher.user.name,
        email: teacher.user.email,
        subject: teacher.subject,
      },
      newValue: { name: data.name, email: data.email || null, subject: data.subject },
    });

    finish("/admin/teachers", "Teacher updated successfully.");
  } catch {
    fail("/admin/teachers", "Teacher could not be updated. Please try again.");
  }
}

export async function deleteTeacher(teacherId: string): Promise<never> {
  const session = await requireAdmin();
  const teacherRecordId = parseId(teacherId, "/admin/teachers");

  const teacher = await db.teacher.findUnique({
    where: { id: teacherRecordId },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!teacher) {
    fail("/admin/teachers", "Teacher record not found.");
  }

  const assignedCourses = await db.course.count({
    where: { teacherId: teacher.id },
  });

  if (assignedCourses > 0) {
    fail(
      "/admin/teachers",
      "Reassign this teacher's courses before deleting the account.",
    );
  }

  try {
    await db.user.delete({ where: { id: teacher.userId } });
    await writeAuditLog({
      userId: session.user.id,
      action: "TEACHER_REMOVE",
      entity: "Teacher",
      entityId: teacher.id,
      oldValue: {
        name: teacher.user.name,
        email: teacher.user.email,
        subject: teacher.subject,
      },
    });
    finish("/admin/teachers", "Teacher deleted successfully.");
  } catch {
    fail("/admin/teachers", "Teacher could not be deleted. Please try again.");
  }
}

export async function createCourse(formData: FormData): Promise<never> {
  const session = await requireAdmin();

  const data = parseForm(courseSchema, formData, "/admin/courses");

  try {
    const teacher = await db.teacher.findUnique({
      where: { id: data.teacherId },
      select: { id: true },
    });

    if (!teacher) {
      fail("/admin/courses", "Select an existing teacher.");
    }

    const course = await db.course.create({
      data: {
        name: data.name,
        description: data.description || null,
        price: data.price,
        duration: data.duration,
        teacherId: data.teacherId,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "COURSE_ADD",
      entity: "Course",
      entityId: course.id,
      newValue: {
        name: data.name,
        price: data.price,
        duration: data.duration,
        teacherId: data.teacherId,
      },
    });

    finish("/admin/courses", "Course added successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) {
      throw error;
    }

    fail("/admin/courses", "Course could not be added. Please try again.");
  }
}

export async function updateCourse(formData: FormData): Promise<never> {
  const session = await requireAdmin();

  const data = parseForm(courseSchema, formData, "/admin/courses");

  if (!data.courseId) {
    fail("/admin/courses", "Course record not found.");
  }

  const existingCourse = await db.course.findUnique({
    where: { id: data.courseId },
  });

  if (!existingCourse) {
    fail("/admin/courses", "Course record not found.");
  }

  try {
    const teacher = await db.teacher.findUnique({
      where: { id: data.teacherId },
      select: { id: true },
    });

    if (!teacher) {
      fail("/admin/courses", "Select an existing teacher.");
    }

    await db.course.update({
      where: { id: data.courseId },
      data: {
        name: data.name,
        description: data.description || null,
        price: data.price,
        duration: data.duration,
        teacherId: data.teacherId,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "COURSE_UPDATE",
      entity: "Course",
      entityId: existingCourse.id,
      oldValue: {
        name: existingCourse.name,
        price: existingCourse.price.toString(),
        duration: existingCourse.duration,
        teacherId: existingCourse.teacherId,
      },
      newValue: {
        name: data.name,
        price: data.price,
        duration: data.duration,
        teacherId: data.teacherId,
      },
    });

    finish("/admin/courses", "Course updated successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) {
      throw error;
    }

    fail("/admin/courses", "Course could not be updated. Please try again.");
  }
}

export async function deleteCourse(courseId: string): Promise<never> {
  const session = await requireAdmin();
  const courseRecordId = parseId(courseId, "/admin/courses");

  const course = await db.course.findUnique({
    where: { id: courseRecordId },
  });

  if (!course) {
    fail("/admin/courses", "Course record not found.");
  }

  const [studentCount, applicationCount, gradeCount] = await Promise.all([
    db.student.count({ where: { courseId: courseRecordId } }),
    db.application.count({ where: { courseId: courseRecordId } }),
    db.grade.count({ where: { courseId: courseRecordId } }),
  ]);

  if (studentCount > 0 || applicationCount > 0 || gradeCount > 0) {
    fail(
      "/admin/courses",
      "This course has related students, grades, or applications and cannot be deleted yet.",
    );
  }

  try {
    await db.course.delete({ where: { id: courseRecordId } });
    await writeAuditLog({
      userId: session.user.id,
      action: "COURSE_REMOVE",
      entity: "Course",
      entityId: course.id,
      oldValue: {
        name: course.name,
        price: course.price.toString(),
        duration: course.duration,
        teacherId: course.teacherId,
      },
    });
    finish("/admin/courses", "Course deleted successfully.");
  } catch {
    fail("/admin/courses", "Course could not be deleted. Please try again.");
  }
}

export async function updateApplicationStatus(
  applicationId: string,
  status: "APPROVED" | "REJECTED",
): Promise<never> {
  const session = await requireAdmin();
  const applicationRecordId = parseId(
    applicationId,
    "/admin/applications",
  );

  const parsed = applicationStatusSchema.safeParse(status);

  if (!parsed.success) {
    fail("/admin/applications", "Invalid application status.");
  }

  const application = await db.application.findUnique({
    where: { id: applicationRecordId },
  });

  if (!application) {
    fail("/admin/applications", "Application not found.");
  }

  try {
    await db.application.update({
      where: { id: applicationRecordId },
      data: { status: parsed.data },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "APPLICATION_STATUS",
      entity: "Application",
      entityId: application.id,
      oldValue: { status: application.status },
      newValue: { status: parsed.data },
    });

    finish("/admin/applications", `Application ${parsed.data.toLowerCase()}.`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) {
      throw error;
    }

    fail("/admin/applications", "Application status could not be updated.");
  }
}

export async function createPayment(formData: FormData): Promise<never> {
  const session = await requireAdmin();

  const data = parseForm(paymentCreateSchema, formData, "/admin/payments");

  try {
    const student = await db.student.findUnique({
      where: { id: data.studentId },
      select: { userId: true },
    });

    if (!student) {
      fail("/admin/payments", "Student enrollment not found.");
    }

    const receiptNumber = await createReceiptNumber();
    const payment = await db.payment.create({
      data: {
        receiptNumber,
        studentId: data.studentId,
        amount: data.amount,
        date: data.date,
        status: data.status,
        method: data.method,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "PAYMENT_CREATE",
      entity: "Payment",
      entityId: payment.id,
      newValue: {
        receiptNumber: payment.receiptNumber,
        studentId: payment.studentId,
        amount: payment.amount.toString(),
        status: payment.status,
        method: payment.method,
      },
    });

    finish("/admin/payments", "Payment recorded successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) {
      throw error;
    }

    fail("/admin/payments", "Payment could not be recorded. Please try again.");
  }
}

export async function updatePaymentStatus(
  paymentId: string,
  formData: FormData,
): Promise<never> {
  const session = await requireAdmin();
  const paymentRecordId = parseId(paymentId, "/admin/payments");

  // `parseForm` always builds an object from the FormData entries, so a bare
  // ZodEnum can never parse it. Wrap the enum in an object schema instead.
  const data = parseForm(
    z.object({ status: paymentStatusSchema }),
    formData,
    "/admin/payments",
  );
  const existingPayment = await db.payment.findUnique({
    where: { id: paymentRecordId },
  });

  if (!existingPayment) {
    fail("/admin/payments", "Payment not found.");
  }

  try {
    const payment = await db.payment.update({
      where: { id: paymentRecordId },
      data: { status: data.status },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "PAYMENT_STATUS_UPDATE",
      entity: "Payment",
      entityId: payment.id,
      oldValue: { status: existingPayment.status },
      newValue: { status: payment.status },
    });

    finish("/admin/payments", "Payment status updated.");
  } catch {
    fail("/admin/payments", "Payment status could not be updated.");
  }
}

export async function createGrade(formData: FormData): Promise<never> {
  const data = parseForm(gradeSchema, formData, "/admin");
  const { course, session } = await requireCourseEditor(
    data.courseId,
    "/admin",
  );
  const destination = session.user.role === "ADMIN" ? "/admin" : "/teacher";

  try {
    const student = await db.student.findUnique({
      where: { id: data.studentId },
      select: { courseId: true },
    });

    if (!student || student.courseId !== course.id) {
      fail(destination, "Student is not enrolled in this course.");
    }

    const grade = await db.grade.create({
      data: {
        studentId: data.studentId,
        courseId: data.courseId,
        score: data.score,
        comment: data.comment || null,
        date: data.date,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "GRADE_CREATE",
      entity: "Grade",
      entityId: grade.id,
      newValue: {
        studentId: grade.studentId,
        courseId: grade.courseId,
        score: grade.score.toString(),
        date: grade.date.toISOString(),
      },
    });

    finish(destination, "Grade recorded successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) {
      throw error;
    }

    fail(destination, "Grade could not be recorded. Please try again.");
  }
}

export async function updateGrade(formData: FormData): Promise<never> {
  const data = parseForm(gradeSchema, formData, "/admin");

  if (!data.gradeId) {
    fail("/admin", "Grade record not found.");
  }

  const existingGrade = await db.grade.findUnique({
    where: { id: data.gradeId },
  });

  if (!existingGrade) {
    fail("/admin", "Grade record not found.");
  }

  const { session } = await requireCourseEditor(
    existingGrade.courseId,
    "/admin",
  );
  const destination = session.user.role === "ADMIN" ? "/admin" : "/teacher";

  try {
    const grade = await db.grade.update({
      where: { id: data.gradeId },
      data: {
        score: data.score,
        comment: data.comment || null,
        date: data.date,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "GRADE_UPDATE",
      entity: "Grade",
      entityId: grade.id,
      oldValue: {
        courseId: existingGrade.courseId,
        score: existingGrade.score.toString(),
        comment: existingGrade.comment,
      },
      newValue: {
        courseId: grade.courseId,
        score: grade.score.toString(),
        comment: grade.comment,
      },
    });

    finish(destination, "Grade updated successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) {
      throw error;
    }

    fail(destination, "Grade could not be updated. Please try again.");
  }
}
