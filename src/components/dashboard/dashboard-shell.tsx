import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { logout } from "@/app/[locale]/(dashboard)/actions";
import { SidebarNav, type SidebarNavItem } from "@/components/dashboard/sidebar-nav";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";

type DashboardNavItem = SidebarNavItem;

interface DashboardShellProps {
  children: ReactNode;
  navigation?: DashboardNavItem[];
  role: string;
  title: string;
  userName?: string | null;
}

export async function DashboardShell({
  children,
  navigation = [{ href: "/dashboard", label: "Dashboard" }],
  role,
  title,
  userName,
}: DashboardShellProps) {
  const t = await getTranslations("common");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="border-b border-slate-200 bg-slate-950 px-6 py-6 text-white dark:border-slate-800 lg:min-h-screen lg:border-b-0">
        <Link href="/" aria-label="Ilm Ummoni" className="inline-block">
          <Image
            alt="Ilm Ummoni"
            height={32}
            priority
            src="/logo.png"
            width={76}
          />
        </Link>
        <p className="mt-2 text-sm text-slate-400">{title}</p>
        <nav className="mt-8">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {t("workspace")}
          </p>
          <SidebarNav items={navigation} />
        </nav>
        <div className="mt-8">
          <LanguageSwitcher compact />
        </div>
        <form action={logout} className="mt-6">
          <button
            type="submit"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/10"
          >
            {t("signOut")}
          </button>
        </form>
      </aside>
      <div className="min-w-0">
        <header className="border-b border-slate-200 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900 sm:px-8">
          <p className="text-sm font-medium uppercase tracking-wider text-brand-700 dark:text-brand-400">
            {role}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{title}</h1>
          {userName ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{userName}</p> : null}
        </header>
        <main className="p-6 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
