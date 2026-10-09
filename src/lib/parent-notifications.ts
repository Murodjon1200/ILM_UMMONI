import { db } from "@/lib/db";

/**
 * Fan-out helper for parent alerts. Best-effort: a notification failure must
 * never roll back the attendance/grade/badge write that triggered it.
 */
export async function notifyParents(input: {
  studentIds: string[];
  type: "ABSENCE" | "GRADE" | "BADGE" | "PAYMENT";
  severity?: "info" | "warning" | "danger";
  title: (studentName: string) => string;
  body: (studentName: string) => string;
}) {
  const studentIds = [...new Set(input.studentIds)].filter(Boolean);

  if (studentIds.length === 0) {
    return 0;
  }

  try {
    const students = await db.student.findMany({
      where: { id: { in: studentIds }, parentId: { not: null } },
      select: { id: true, parentId: true, user: { select: { name: true } } },
    });

    if (students.length === 0) {
      return 0;
    }

    // Deduplicate per (parent, type) within a short window so a bulk save does
    // not create one notification per student record.
    const rows = students.flatMap((student) => {
      if (!student.parentId) {
        return [];
      }

      const recent = { gte: new Date(Date.now() - 60 * 60 * 1000) };

      return [
        {
          parentId: student.parentId,
          studentId: student.id,
          type: input.type,
          severity: input.severity ?? "info",
          title: input.title(student.user.name),
          body: input.body(student.user.name),
          createdAt: new Date(),
          _recent: recent,
        },
      ];
    });

    const created: {
      parentId: string;
      studentId: string;
      type: string;
      severity: string;
      title: string;
      body: string;
    }[] = [];

    for (const row of rows) {
      const existing = await db.parentNotification.findFirst({
        where: {
          parentId: row.parentId,
          studentId: row.studentId,
          type: row.type,
          createdAt: row._recent,
        },
        select: { id: true },
      });

      if (existing) {
        continue;
      }

      await db.parentNotification.create({
        data: {
          parentId: row.parentId,
          studentId: row.studentId,
          type: row.type,
          severity: row.severity,
          title: row.title,
          body: row.body,
        },
      });

      created.push(row);
    }

    return created.length;
  } catch {
    return 0;
  }
}