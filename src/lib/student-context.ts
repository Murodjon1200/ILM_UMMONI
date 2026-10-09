import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export const getStudentContext = cache(async () => {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "STUDENT") {
    redirect("/unauthorized");
  }

  const enrollments = await db.student.findMany({
    where: { userId: session.user.id },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      courseId: true,
      startDate: true,
      status: true,
      course: {
        select: {
          id: true,
          name: true,
          description: true,
          duration: true,
          teacher: {
            select: {
              subject: true,
              user: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return { enrollments, session };
});
