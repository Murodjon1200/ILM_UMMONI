import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("owner");
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "OWNER") {
    redirect("/unauthorized");
  }

  const navigation = [
    { href: "/owner", label: t("nav.overview") },
    { href: "/owner/statistics", label: t("nav.statistics") },
    { href: "/owner/courses", label: t("nav.courses") },
    { href: "/owner/teachers", label: t("nav.teachers") },
  ];

  return (
    <DashboardShell
      navigation={navigation}
      role={t("role")}
      title={t("title")}
      userName={session.user.name}
    >
      {children}
    </DashboardShell>
  );
}
