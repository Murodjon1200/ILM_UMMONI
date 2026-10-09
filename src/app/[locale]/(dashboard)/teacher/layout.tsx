import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("teacher");
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "TEACHER") {
    redirect("/unauthorized");
  }

  const navigation = [
    { href: "/teacher", label: t("nav.overview") },
    { href: "/teacher/students", label: t("nav.students") },
    { href: "/teacher/schedule", label: t("nav.schedule") },
    { href: "/teacher/attendance", label: t("nav.attendance") },
    { href: "/teacher/grades", label: t("nav.grades") },
  ];

  return (
    <DashboardShell
      navigation={navigation}
      role="Teacher"
      title={t("nav.overview")}
      userName={session.user.name}
    >
      {children}
    </DashboardShell>
  );
}
