import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

const dashboardRoutes: Record<Role, string | null> = {
  ADMIN: "/admin",
  TEACHER: "/teacher",
  STUDENT: "/student",
  OWNER: "/owner",
  PARENT: "/parent",
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.role) {
    redirect("/unauthorized");
  }

  const destination = dashboardRoutes[session.user.role];

  if (!destination) {
    redirect("/unauthorized");
  }

  redirect(destination);
}
