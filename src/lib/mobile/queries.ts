import type {
  AttendanceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Role,
  StudentStatus,
} from "@prisma/client";

import { formatScheduleTime, getDayOfWeekInTashkent } from "@/lib/date";
import { db } from "@/lib/db";
import { forbidden } from "@/lib/mobile/api-error";
import type { MobileUser } from "@/lib/mobile/session";

const staffRoles: Role[] = ["ADMIN", "TEACHER"];
const readAllRoles: Role[] = ["ADMIN", "OWNER"];

function assertOneOf(user: MobileUser, roles: Role[]) {
  if (!roles.includes(user.role)) {
    throw forbidden();
  }
}

export interface StudentListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  courseId: string;
  courseName: string;
  startDate: string;
  status: StudentStatus;
}

export interface TeacherListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  subject: string;
  bio: string | null;
  courseCount: number;
}

export interface CourseListItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  teacherId: string;
  teacherName: string;
  studentCount: number;
}

export interface ScheduleListItem {
  id: string;
  courseId: string;
  courseName: string;
  teacherName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
}

export interface GradeListItem {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  score: number;
  comment: string | null;
  date: string;
}

export interface AttendanceListItem {
  id: string;
  studentId: string;
  studentName: string;
  scheduleId: string;
  courseName: string;
  date: string;
  status: AttendanceStatus;
}

export interface PaymentListItem {
  id: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  courseName: string;
  amount: number;
  date: string;
  status: PaymentStatus;
  method: PaymentMethod;
}

export interface ChildListItem {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  startDate: string;
  status: StudentStatus;
}

export type NotificationType = "ATTENDANCE" | "GRADE" | "PAYMENT";

export type NotificationSeverity = "info" | "warning" | "danger";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  date: string;
  read: boolean;
}

const studentListSelect = {
  id: true,
  startDate: true,
  status: true,
  courseId: true,
  user: { select: { name: true, email: true, phone: true } },
  course: { select: { name: true } },
} satisfies Prisma.StudentSelect;

const gradeListSelect = {
  id: true,
  studentId: true,
  courseId: true,
  score: true,
  comment: true,
  date: true,
  student: { select: { user: { select: { name: true } } } },
  course: { select: { name: true } },
} satisfies Prisma.GradeSelect;

const attendanceListSelect = {
  id: true,
  studentId: true,
  scheduleId: true,
  date: true,
  status: true,
  student: { select: { user: { select: { name: true } } } },
  schedule: { select: { course: { select: { name: true } } } },
} satisfies Prisma.AttendanceSelect;

const paymentListSelect = {
  id: true,
  receiptNumber: true,
  studentId: true,
  amount: true,
  date: true,
  status: true,
  method: true,
  student: {
    select: {
      user: { select: { name: true } },
      course: { select: { name: true } },
    },
  },
} satisfies Prisma.PaymentSelect;

const scheduleListSelect = {
  id: true,
  courseId: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  room: true,
  course: { select: { name: true } },
  teacher: { select: { user: { select: { name: true } } } },
} satisfies Prisma.ScheduleSelect;

const courseListSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  duration: true,
  teacherId: true,
  teacher: { select: { user: { select: { name: true } } } },
  _count: { select: { students: true } },
} satisfies Prisma.CourseSelect;

type StudentListRow = Prisma.StudentGetPayload<{
  select: typeof studentListSelect;
}>;

type GradeListRow = Prisma.GradeGetPayload<{ select: typeof gradeListSelect }>;
type AttendanceListRow = Prisma.AttendanceGetPayload<{
  select: typeof attendanceListSelect;
}>;
type PaymentListRow = Prisma.PaymentGetPayload<{
  select: typeof paymentListSelect;
}>;
type ScheduleListRow = Prisma.ScheduleGetPayload<{
  select: typeof scheduleListSelect;
}>;
type CourseListRow = Prisma.CourseGetPayload<{
  select: typeof courseListSelect;
}>;

function toStudentItem(row: StudentListRow): StudentListItem {
  return {
    id: row.id,
    name: row.user.name,
    email: row.user.email,
    phone: row.user.phone,
    courseId: row.courseId,
    courseName: row.course.name,
    startDate: row.startDate.toISOString(),
    status: row.status,
  };
}

function toGradeItem(row: GradeListRow): GradeListItem {
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: row.student.user.name,
    courseId: row.courseId,
    courseName: row.course.name,
    score: Number(row.score),
    comment: row.comment,
    date: row.date.toISOString(),
  };
}

function toAttendanceItem(row: AttendanceListRow): AttendanceListItem {
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: row.student.user.name,
    scheduleId: row.scheduleId,
    courseName: row.schedule.course.name,
    date: row.date.toISOString(),
    status: row.status,
  };
}

function toPaymentItem(row: PaymentListRow): PaymentListItem {
  return {
    id: row.id,
    receiptNumber: row.receiptNumber,
    studentId: row.studentId,
    studentName: row.student.user.name,
    courseName: row.student.course.name,
    amount: Number(row.amount),
    date: row.date.toISOString(),
    status: row.status,
    method: row.method,
  };
}

function toScheduleItem(row: ScheduleListRow): ScheduleListItem {
  return {
    id: row.id,
    courseId: row.courseId,
    courseName: row.course.name,
    teacherName: row.teacher.user.name,
    dayOfWeek: row.dayOfWeek,
    startTime: formatScheduleTime(row.startTime),
    endTime: formatScheduleTime(row.endTime),
    room: row.room,
  };
}

function toCourseItem(row: CourseListRow): CourseListItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    duration: row.duration,
    teacherId: row.teacherId,
    teacherName: row.teacher.user.name,
    studentCount: row._count.students,
  };
}

async function getTeacherCourseIds(userId: string) {
  const courses = await db.course.findMany({
    where: { teacher: { userId } },
    select: { id: true },
  });

  return courses.map(({ id }) => id);
}

async function getOwnStudentIds(userId: string) {
  const enrollments = await db.student.findMany({
    where: { userId },
    select: { id: true },
  });

  return enrollments.map(({ id }) => id);
}

async function getChildStudentIds(parentId: string) {
  const children = await db.student.findMany({
    where: { parentId },
    select: { id: true },
  });

  return children.map(({ id }) => id);
}

export type StudentScope = {
  /** null only for roles allowed to see every record in the center */
  studentIds: string[] | null;
  courseIds: string[] | null;
};

/**
 * Resolves which student records a role may read.
 *
 * `studentIds` is null ONLY for ADMIN/OWNER. Every other role gets a concrete
 * list, so a caller that forgets to handle a role fails closed instead of
 * silently querying the whole table.
 */
export async function resolveStudentScope(
  user: MobileUser,
): Promise<StudentScope> {
  if (canReadEveryRecord(user)) {
    return { studentIds: null, courseIds: null };
  }

  if (user.role === "TEACHER") {
    const [courseIds, studentIds] = await Promise.all([
      getTeacherCourseIds(user.id),
      db.student.findMany({
        where: { course: { teacher: { userId: user.id } } },
        select: { id: true },
      }),
    ]);

    return { studentIds: studentIds.map(({ id }) => id), courseIds };
  }

  if (user.role === "STUDENT") {
    return { studentIds: await getOwnStudentIds(user.id), courseIds: null };
  }

  if (user.role === "PARENT") {
    const parent = await db.parent.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!parent) {
      throw forbidden();
    }

    return { studentIds: await getChildStudentIds(parent.id), courseIds: null };
  }

  // Any role not handled above is refused outright rather than being treated as
  // unrestricted.
  throw forbidden();
}

/** The only roles permitted to read every record in the center. */
function canReadEveryRecord(user: MobileUser) {
  return user.role === "ADMIN" || user.role === "OWNER";
}

/**
 * Fail-closed guard. Returns the explicit allow-list of student ids for a
 * scoped role, and throws 403 rather than ever yielding an unrestricted filter.
 */
function requireScopedStudentIds(scope: StudentScope): string[] {
  if (scope.studentIds === null) {
    throw forbidden();
  }

  return scope.studentIds;
}

/**
 * Builds a Student row filter. Unrestricted access is decided by an explicit
 * role check, never by a `null` sentinel, so a bug in scope resolution cannot
 * silently widen the query to the whole table.
 */
function studentRowFilter(
  user: MobileUser,
  scope: StudentScope,
): Prisma.StudentWhereInput {
  if (canReadEveryRecord(user)) {
    return {};
  }

  return { id: { in: requireScopedStudentIds(scope) } };
}

/** Same guarantee for rows that reference a student (Grade, Attendance, Payment). */
function studentChildFilter(
  user: MobileUser,
  scope: StudentScope,
  field: "studentId",
): { [key: string]: { in: string[] } } {
  if (canReadEveryRecord(user)) {
    return {};
  }

  return { [field]: { in: requireScopedStudentIds(scope) } };
}

/** Nested form used when filtering through `Course.students`. */
function studentsSomeFilter(user: MobileUser, scope: StudentScope) {
  if (canReadEveryRecord(user)) {
    return {};
  }

  return { students: { some: { id: { in: requireScopedStudentIds(scope) } } } };
}

export async function listStudents(
  user: MobileUser,
  limit = 200,
): Promise<StudentListItem[]> {
  if (user.role === "OWNER" || user.role === "PARENT") {
    return [];
  }

  const scope = await resolveStudentScope(user);

  const rows = await db.student.findMany({
    where: studentRowFilter(user, scope),
    select: studentListSelect,
    orderBy: [{ startDate: "desc" }],
    take: limit,
  });

  return rows.map(toStudentItem);
}

export async function listTeachers(
  user: MobileUser,
): Promise<TeacherListItem[]> {
  assertOneOf(user, readAllRoles);

  const rows = await db.teacher.findMany({
    select: {
      id: true,
      subject: true,
      bio: true,
      user: { select: { name: true, email: true, phone: true } },
      _count: { select: { courses: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.user.name,
    email: row.user.email,
    phone: row.user.phone,
    subject: row.subject,
    bio: row.bio,
    courseCount: row._count.courses,
  }));
}

export async function listCourses(user: MobileUser): Promise<CourseListItem[]> {
  let where: Prisma.CourseWhereInput = {};

  if (user.role === "TEACHER") {
    where = { teacher: { userId: user.id } };
  } else if (user.role === "STUDENT") {
    where = { students: { some: { userId: user.id } } };
  } else if (user.role === "PARENT") {
    where = studentsSomeFilter(user, await resolveStudentScope(user));
  } else if (!readAllRoles.includes(user.role)) {
    throw forbidden();
  }

  const rows = await db.course.findMany({
    where,
    select: courseListSelect,
    orderBy: { name: "asc" },
  });

  return rows.map(toCourseItem);
}

export async function listSchedules(
  user: MobileUser,
): Promise<ScheduleListItem[]> {
  let where: Prisma.ScheduleWhereInput = {};

  if (user.role === "TEACHER") {
    where = { teacher: { userId: user.id } };
  } else if (user.role === "STUDENT") {
    where = { course: { students: { some: { userId: user.id } } } };
  } else if (user.role === "PARENT") {
    where = {
      course: studentsSomeFilter(user, await resolveStudentScope(user)),
    };
  } else if (!readAllRoles.includes(user.role)) {
    throw forbidden();
  }

  const rows = await db.schedule.findMany({
    where,
    select: scheduleListSelect,
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return rows.map(toScheduleItem);
}

export async function listGrades(
  user: MobileUser,
  limit = 100,
): Promise<GradeListItem[]> {
  const scope = await resolveStudentScope(user);

  const where: Prisma.GradeWhereInput = studentChildFilter(
    user,
    scope,
    "studentId",
  );

  const rows = await db.grade.findMany({
    where,
    select: gradeListSelect,
    orderBy: { date: "desc" },
    take: limit,
  });

  return rows.map(toGradeItem);
}

export async function listAttendance(
  user: MobileUser,
  limit = 100,
): Promise<AttendanceListItem[]> {
  const scope = await resolveStudentScope(user);

  const where: Prisma.AttendanceWhereInput = studentChildFilter(
    user,
    scope,
    "studentId",
  );

  const rows = await db.attendance.findMany({
    where,
    select: attendanceListSelect,
    orderBy: { date: "desc" },
    take: limit,
  });

  return rows.map(toAttendanceItem);
}

export async function listPayments(
  user: MobileUser,
  limit = 100,
): Promise<PaymentListItem[]> {
  const scope = await resolveStudentScope(user);

  const where: Prisma.PaymentWhereInput = studentChildFilter(
    user,
    scope,
    "studentId",
  );

  const rows = await db.payment.findMany({
    where,
    select: paymentListSelect,
    orderBy: { date: "desc" },
    take: limit,
  });

  return rows.map(toPaymentItem);
}

export async function listChildren(
  user: MobileUser,
): Promise<ChildListItem[]> {
  assertOneOf(user, ["PARENT"]);

  const parent = await db.parent.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!parent) {
    throw forbidden();
  }

  const rows = await db.student.findMany({
    where: { parentId: parent.id },
    select: studentListSelect,
    orderBy: { startDate: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.user.name,
    courseId: row.courseId,
    courseName: row.course.name,
    startDate: row.startDate.toISOString(),
    status: row.status,
  }));
}

export async function getOverview(user: MobileUser) {
  if (user.role === "ADMIN" || user.role === "OWNER") {
    const [students, teachers, courses, paidPayments] = await Promise.all([
      db.user.count({ where: { role: "STUDENT" } }),
      db.user.count({ where: { role: "TEACHER" } }),
      db.course.count(),
      db.payment.aggregate({
        where: { status: "PAID" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      kind: "center" as const,
      students,
      teachers,
      courses,
      paidPayments: paidPayments._count,
      revenue: Number(paidPayments._sum.amount ?? 0),
    };
  }

  if (user.role === "TEACHER") {
    const [courses, students, todaySchedules] = await Promise.all([
      db.course.count({ where: { teacher: { userId: user.id } } }),
      db.student.count({ where: { course: { teacher: { userId: user.id } } } }),
      db.schedule.count({
        where: {
          teacher: { userId: user.id },
          dayOfWeek: getDayOfWeekInTashkent(new Date()),
        },
      }),
    ]);

    return {
      kind: "teacher" as const,
      courses,
      students,
      classesToday: todaySchedules,
    };
  }

  // Reached only by STUDENT/PARENT; a scoped allow-list is required.
  const scopedStudentIds = requireScopedStudentIds(
    await resolveStudentScope(user),
  );

  const [enrollments, grades, attendance, payments] = await Promise.all([
    db.student.count({ where: { id: { in: scopedStudentIds } } }),
    db.grade.count({ where: { studentId: { in: scopedStudentIds } } }),
    db.attendance.count({ where: { studentId: { in: scopedStudentIds } } }),
    db.payment.findMany({
      where: { studentId: { in: scopedStudentIds }, status: "PAID" },
      select: { amount: true },
    }),
  ]);

  return {
    kind: user.role === "PARENT" ? ("parent" as const) : ("student" as const),
    children: enrollments,
    grades,
    attendance,
    paidAmount: payments.reduce((total, payment) => total + Number(payment.amount), 0),
  };
}

function getMonthKeys(count: number, referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - (count - 1 - index), 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

const gradeFailThreshold = 50;
const gradeWarnThreshold = 60;

const attendanceCopy: Record<
  Exclude<AttendanceStatus, "PRESENT">,
  { severity: NotificationSeverity; body: string }
> = {
  ABSENT: { severity: "danger", body: "Darsga kelmadi" },
  LATE: { severity: "warning", body: "Darsga kechikdi" },
  EXCUSED: { severity: "info", body: "Sababli kelmadi" },
};

/**
 * Parent-facing alerts derived from attendance, grades and outstanding payments.
 * Computed server-side so the client only has to render, and so the thresholds
 * live in one place.
 */
export async function listNotifications(
  user: MobileUser,
): Promise<NotificationItem[]> {
  assertOneOf(user, ["PARENT"]);

  // Prefer the durable rows written by notifyParents so history survives and
  // unread state is meaningful. Rows created before that table existed are not
  // backfilled, so fall back to the derived view when nothing is stored yet.
  const parent = await db.parent.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!parent) {
    throw forbidden();
  }

  const stored = await db.parentNotification.findMany({
    where: { parentId: parent.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (stored.length > 0) {
    return stored.map<NotificationItem>((row) => ({
      id: row.id,
      type: (
        row.type === "GRADE" || row.type === "BADGE" || row.type === "PAYMENT"
          ? row.type
          : "ATTENDANCE"
      ) as NotificationType,
      severity: (
        row.severity === "danger" || row.severity === "warning"
          ? row.severity
          : "info"
      ) as NotificationSeverity,
      title: row.title,
      body: row.body,
      date: row.createdAt.toISOString(),
      read: row.readAt !== null,
    }));
  }

  const scoped = requireScopedStudentIds(await resolveStudentScope(user));

  if (scoped.length === 0) {
    return [];
  }

  const [attendance, grades, payments] = await Promise.all([
    db.attendance.findMany({
      where: { studentId: { in: scoped } },
      select: {
        id: true,
        date: true,
        status: true,
        student: { select: { user: { select: { name: true } } } },
        schedule: { select: { course: { select: { name: true } } } },
      },
      orderBy: { date: "desc" },
      take: 50,
    }),
    db.grade.findMany({
      where: { studentId: { in: scoped } },
      select: {
        id: true,
        date: true,
        score: true,
        student: { select: { user: { select: { name: true } } } },
        course: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 50,
    }),
    db.payment.findMany({
      where: { studentId: { in: scoped }, status: "PENDING" },
      select: {
        id: true,
        amount: true,
        date: true,
        student: { select: { user: { select: { name: true } } } },
      },
      orderBy: { date: "desc" },
      take: 20,
    }),
  ]);

  const items: NotificationItem[] = [];

  for (const record of attendance) {
    if (record.status === "PRESENT") {
      continue;
    }

    const copy = attendanceCopy[record.status];

    items.push({
      id: `attendance-${record.id}`,
      type: "ATTENDANCE",
      severity: copy.severity,
      title: `${record.student.user.name} · ${record.schedule.course.name}`,
      body: copy.body,
      date: record.date.toISOString(),
      read: false,
    });
  }

  for (const grade of grades) {
    const score = Number(grade.score);

    if (score >= gradeWarnThreshold) {
      continue;
    }

    items.push({
      id: `grade-${grade.id}`,
      type: "GRADE",
      severity: score < gradeFailThreshold ? "danger" : "warning",
      title: `${grade.student.user.name} · ${grade.course.name}`,
      body: `Baho ${grade.score} — natijani ko'rib chiqish tavsiya etiladi.`,
      date: grade.date.toISOString(),
      read: false,
    });
  }

  for (const payment of payments) {
    items.push({
      id: `payment-${payment.id}`,
      type: "PAYMENT",
      severity: "warning",
      title: payment.student.user.name,
      body: `${payment.amount.toString()} so'm to'lov kutilmoqda.`,
      date: payment.date.toISOString(),
      read: false,
    });
  }

  return items
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 50);
}

/** Marks every stored alert for the parent as read (clears the tab badge). */
export async function markNotificationsRead(user: MobileUser) {
  assertOneOf(user, ["PARENT"]);

  const parent = await db.parent.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!parent) {
    throw forbidden();
  }

  const result = await db.parentNotification.updateMany({
    where: { parentId: parent.id, readAt: null },
    data: { readAt: new Date() },
  });

  return { updated: result.count };
}

export async function getStatistics(user: MobileUser) {
  assertOneOf(user, ["OWNER"]);

  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const [students, courses, payments] = await Promise.all([
    db.user.findMany({
      where: { role: "STUDENT" },
      select: { createdAt: true },
    }),
    db.course.findMany({
      orderBy: { students: { _count: "desc" } },
      take: 10,
      select: {
        id: true,
        name: true,
        teacher: { select: { user: { select: { name: true } } } },
        _count: { select: { students: true } },
      },
    }),
    db.payment.findMany({
      where: { status: "PAID" },
      select: { amount: true, date: true },
    }),
  ]);

  const paidDates = payments.map((payment) => payment.date.toISOString().slice(0, 7));
  const studentDates = students.map((student) =>
    student.createdAt.toISOString().slice(0, 7),
  );

  const revenue = getMonthKeys(12, now).map((month) => ({
    month,
    revenue: payments
      .filter((_, index) => paidDates[index] === month)
      .reduce((total, payment) => total + Number(payment.amount), 0),
  }));

  const growth = getMonthKeys(6, now).map((month) => ({
    month,
    students: studentDates.filter((value) => value === month).length,
  }));

  const annualRevenue = payments
    .filter((payment) => payment.date >= yearStart)
    .reduce((total, payment) => total + Number(payment.amount), 0);

  return {
    revenue,
    growth,
    annualRevenue,
    studentCount: students.length,
    totalEnrollments: courses.reduce(
      (total, course) => total + course._count.students,
      0,
    ),
    averagePayment: payments.length ? annualRevenue / payments.length : 0,
    topCourses: courses.map((course) => ({
      id: course.id,
      name: course.name,
      teacherName: course.teacher.user.name,
      students: course._count.students,
    })),
  };
}

export { staffRoles, readAllRoles };
