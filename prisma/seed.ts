import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

import { strongPasswordSchema } from "../src/lib/password";

const db = new PrismaClient();

const sampleAccounts = {
  admin: { email: "admin@ilmummoni.uz", name: "Admin", phone: "998900000001", password: "Adm!n@IlmUmm0n!#2026", role: "ADMIN" as const },
  owner: { email: "owner@ilmummoni.uz", name: "Owner", phone: "998900000000", password: "0wn3r@IlmUmm0n!#2026", role: "OWNER" as const },
  teacher: { email: "teacher@ilmummoni.uz", name: "Aziz Karimov", phone: "998900000002", password: "T3ach3r@IlmUmm0n!#2026", role: "TEACHER" as const },
  student: { email: "student@ilmummoni.uz", name: "Malika Yusupova", phone: "998900000003", password: "Stud3nt@IlmUmm0n!#2026", role: "STUDENT" as const },
  parent: { email: "parent@ilmummoni.uz", name: "Nodira Yusupova", phone: "998900000009", password: "P@r3nt@IlmUmm0n!#2026", role: "PARENT" as const },
};

async function upsertSeedUser(account: (typeof sampleAccounts)[keyof typeof sampleAccounts], passwordHash: string) {
  const existingByEmail = await db.user.findUnique({ where: { email: account.email } });

  if (existingByEmail && existingByEmail.phone !== account.phone) {
    await db.user.update({
      where: { id: existingByEmail.id },
      data: { phone: account.phone },
    });
  }

  return db.user.upsert({
    where: { phone: account.phone },
    create: {
      name: account.name,
      email: account.email,
      phone: account.phone,
      password: passwordHash,
      role: account.role,
    },
    update: {
      name: account.name,
      email: account.email,
      phone: account.phone,
      password: passwordHash,
      role: account.role,
    },
  });
}

async function main() {
  for (const account of Object.values(sampleAccounts)) {
    strongPasswordSchema.parse(account.password);
  }

  const [adminPassword, ownerPassword, teacherPassword, studentPassword, parentPassword] = await Promise.all([
    hash(sampleAccounts.admin.password, 12),
    hash(sampleAccounts.owner.password, 12),
    hash(sampleAccounts.teacher.password, 12),
    hash(sampleAccounts.student.password, 12),
    hash(sampleAccounts.parent.password, 12),
  ]);

  const admin = await upsertSeedUser(sampleAccounts.admin, adminPassword);
  const owner = await upsertSeedUser(sampleAccounts.owner, ownerPassword);
  const teacherUser = await upsertSeedUser(sampleAccounts.teacher, teacherPassword);

  const teacher = await db.teacher.upsert({
    where: { userId: teacherUser.id },
    create: {
      userId: teacherUser.id,
      bio: "Experienced teacher specializing in computer science and language education.",
      subject: "Computer Science and Languages",
    },
    update: {
      bio: "Experienced teacher specializing in computer science and language education.",
      subject: "Computer Science and Languages",
    },
  });

  const webDevelopmentCourse = await db.course.upsert({
    where: { id: "seed-course-web-development" },
    create: {
      id: "seed-course-web-development",
      name: "Web Development",
      description: "HTML, CSS, JavaScript, React, and backend fundamentals.",
      price: "850000.00",
      duration: 360,
      teacherId: teacher.id,
    },
    update: {
      name: "Web Development",
      description: "HTML, CSS, JavaScript, React, and backend fundamentals.",
      price: "850000.00",
      duration: 360,
      teacherId: teacher.id,
    },
  });

  await db.course.upsert({
    where: { id: "seed-course-english" },
    create: {
      id: "seed-course-english",
      name: "English Language",
      description: "English grammar, vocabulary, speaking, and writing.",
      price: "550000.00",
      duration: 240,
      teacherId: teacher.id,
    },
    update: {
      name: "English Language",
      description: "English grammar, vocabulary, speaking, and writing.",
      price: "550000.00",
      duration: 240,
      teacherId: teacher.id,
    },
  });

  const studentUser = await upsertSeedUser(sampleAccounts.student, studentPassword);
  const parentUser = await upsertSeedUser(sampleAccounts.parent, parentPassword);

  const parent = await db.parent.upsert({
    where: { userId: parentUser.id },
    create: { userId: parentUser.id },
    update: {},
  });

  const student = await db.student.upsert({
    where: {
      userId_courseId: {
        userId: studentUser.id,
        courseId: webDevelopmentCourse.id,
      },
    },
    create: {
      userId: studentUser.id,
      courseId: webDevelopmentCourse.id,
      parentId: parent.id,
      startDate: new Date("2026-01-15T00:00:00.000Z"),
      status: "ACTIVE",
    },
    update: {
      parentId: parent.id,
      startDate: new Date("2026-01-15T00:00:00.000Z"),
      status: "ACTIVE",
    },
  });

  const mondayClass = await db.schedule.upsert({
    where: { id: "seed-schedule-web-mon" },
    create: {
      id: "seed-schedule-web-mon",
      courseId: webDevelopmentCourse.id,
      teacherId: teacher.id,
      dayOfWeek: 1,
      startTime: new Date("1970-01-01T09:00:00.000Z"),
      endTime: new Date("1970-01-01T10:30:00.000Z"),
      room: "201",
    },
    update: { room: "201" },
  });

  await db.schedule.upsert({
    where: { id: "seed-schedule-web-thu" },
    create: {
      id: "seed-schedule-web-thu",
      courseId: webDevelopmentCourse.id,
      teacherId: teacher.id,
      dayOfWeek: 4,
      startTime: new Date("1970-01-01T14:00:00.000Z"),
      endTime: new Date("1970-01-01T15:30:00.000Z"),
      room: "203",
    },
    update: { room: "203" },
  });

  const existingPayment = await db.payment.findFirst({
    where: { studentId: student.id },
  });

  if (!existingPayment) {
    await db.payment.create({
      data: {
        studentId: student.id,
        amount: "850000.00",
        date: new Date("2026-01-20T00:00:00.000Z"),
        status: "PAID",
        method: "CASH",
      },
    });
  }

  const existingGrade = await db.grade.findFirst({
    where: { studentId: student.id },
  });

  if (!existingGrade) {
    await db.grade.create({
      data: {
        studentId: student.id,
        courseId: webDevelopmentCourse.id,
        score: "88.50",
        comment: "Strong progress on the module.",
        date: new Date("2026-02-10T00:00:00.000Z"),
      },
    });
  }

  const existingAttendance = await db.attendance.findFirst({
    where: { studentId: student.id, scheduleId: mondayClass.id },
  });

  if (!existingAttendance) {
    await db.attendance.create({
      data: {
        studentId: student.id,
        scheduleId: mondayClass.id,
        date: new Date("2026-02-09T00:00:00.000Z"),
        status: "PRESENT",
      },
    });
  }

  console.log(`Seeded phone logins: ${admin.phone}, ${owner.phone}, ${teacherUser.phone}, ${studentUser.phone}, ${parentUser.phone}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
