import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("student");
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "STUDENT") {
    redirect("/unauthorized");
  }

  const navigation = [
    { href: "/student", label: t("nav.overview") },
    { href: "/student/schedule", label: t("nav.schedule") },
    { href: "/student/grades", label: t("nav.grades") },
    { href: "/student/attendance", label: t("nav.attendance") },
    { href: "/student/payments", label: t("nav.payments") },
  ];

  return (
    <DashboardShell
      navigation={navigation}
      role="Student"
      title={t("nav.overview")}
      userName={session.user.name}
    >
      {children}
    </DashboardShell>
  );
}
