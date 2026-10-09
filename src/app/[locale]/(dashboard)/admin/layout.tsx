import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("admin");
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const navigation = [
    { href: "/admin", label: t("nav.overview") },
    { href: "/admin/students", label: t("nav.students") },
    { href: "/admin/teachers", label: t("nav.teachers") },
    { href: "/admin/courses", label: t("nav.courses") },
    { href: "/admin/applications", label: t("nav.applications") },
    { href: "/admin/payments", label: t("nav.payments") },
    { href: "/admin/schedule", label: t("nav.schedule") },
  ];

  return (
    <DashboardShell
      navigation={navigation}
      role="Admin"
      title={t("nav.overview")}
      userName={session.user.name}
    >
      {children}
    </DashboardShell>
  );
}
