import type { ApplicationStatus } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { db } from "@/lib/db";

import { updateApplicationStatus } from "../actions";

export const dynamic = "force-dynamic";

interface ApplicationsPageProps {
  searchParams: {
    error?: string | string[];
    success?: string | string[];
  };
}

const statusStyles: Record<ApplicationStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  APPROVED: "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300",
  REJECTED: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function ApplicationsPage({
  searchParams,
}: ApplicationsPageProps) {
  const t = await getTranslations("admin");
  const success = getParam(searchParams.success);
  const error = getParam(searchParams.error);

  const [applications, pendingCount, approvedCount, rejectedCount] =
    await Promise.all([
      db.application.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          course: {
            select: { name: true },
          },
        },
      }),
      db.application.count({ where: { status: "PENDING" } }),
      db.application.count({ where: { status: "APPROVED" } }),
      db.application.count({ where: { status: "REJECTED" } }),
    ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
            {t("nav.applications")}
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {t("applications.title")}
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Review new requests and keep the admissions queue moving.
          </p>
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {pendingCount} {t("applications.pending")}
        </p>
      </div>

      {success ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300">
          {success}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          [t("applications.pending"), pendingCount, t("applications.pending")],
          [t("applications.approved"), approvedCount, t("applications.approved")],
          [t("applications.rejected"), rejectedCount, t("applications.rejected")],
        ].map(([label, value, description]) => (
          <section
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">
              {value}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </section>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <h3 className="font-semibold text-slate-950 dark:text-white">
            {t("applications.queue")}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Newest requests appear first. Decisions update immediately.
          </p>
        </div>
        {applications.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {applications.map((application) => (
              <article
                key={application.id}
                className="flex flex-col gap-4 p-5 transition hover:bg-slate-50 dark:hover:bg-slate-800/40 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold tracking-wider text-brand-400 dark:bg-amber-400 dark:text-slate-950">
                    {application.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950 dark:text-white">
                      {application.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {application.phone} · {application.course.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Submitted {formatDate(application.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[application.status]}`}>
                    {application.status.toLowerCase()}
                  </span>
                  {application.status === "PENDING" ? (
                    <>
                      <form>
                        <ConfirmSubmit
                          action={updateApplicationStatus.bind(
                            null,
                            application.id,
                            "APPROVED",
                          )}
                          confirmMessage="Approve this application?"
                            label={t("applications.approve")}
                          variant="secondary"
                        />
                      </form>
                      <form>
                        <ConfirmSubmit
                          action={updateApplicationStatus.bind(
                            null,
                            application.id,
                            "REJECTED",
                          )}
                          confirmMessage="Reject this application?"
                            label={t("applications.reject")}
                        />
                      </form>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            No applications have been submitted yet.
          </div>
        )}
      </section>
    </div>
  );
}