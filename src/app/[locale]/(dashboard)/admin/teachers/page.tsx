import type { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { db } from "@/lib/db";

import {
  createTeacher,
  deleteTeacher,
  updateTeacher,
} from "../actions";

export const dynamic = "force-dynamic";

interface TeachersPageProps {
  searchParams: {
    edit?: string | string[];
    error?: string | string[];
    search?: string | string[];
    success?: string | string[];
  };
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TeachersPage({ searchParams }: TeachersPageProps) {
  const t = await getTranslations("admin");
  const common = await getTranslations("common");
  const search = getParam(searchParams.search)?.trim() ?? "";
  const editId = getParam(searchParams.edit);
  const success = getParam(searchParams.success);
  const error = getParam(searchParams.error);

  const where: Prisma.TeacherWhereInput = search
    ? {
        OR: [
          { user: { name: { contains: search, mode: "insensitive" } } },
          { user: { email: { contains: search, mode: "insensitive" } } },
          { user: { phone: { contains: search, mode: "insensitive" } } },
          { subject: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [teachers, editingTeacher] = await Promise.all([
    db.teacher.findMany({
      where,
      orderBy: { subject: "asc" },
      include: {
        user: {
          select: { name: true, email: true, phone: true },
        },
        _count: { select: { courses: true } },
      },
    }),
    editId
      ? db.teacher.findUnique({
          where: { id: editId },
          include: {
            user: {
              select: { name: true, email: true, phone: true },
            },
          },
        })
      : null,
  ]);

  const isEditing = Boolean(editingTeacher);
  const editSearch = search ? `&search=${encodeURIComponent(search)}` : "";

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
            {t("nav.teachers")}
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {t("teachers.title")}
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Manage teaching accounts, subjects, and biographies.
          </p>
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {teachers.length} {teachers.length === 1 ? "teacher" : "teachers"}
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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-slate-950 dark:text-white">
              {isEditing ? t("teachers.edit") : t("teachers.add")}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isEditing
                ? "Update the teacher's profile and account."
                : "Create a teacher account and profile."}
            </p>
          </div>
          {isEditing ? (
            <Link
              href={`/admin/teachers${search ? `?search=${encodeURIComponent(search)}` : ""}`}
              className="text-sm font-semibold text-cyan-700 hover:underline dark:text-cyan-400"
            >
              Cancel edit
            </Link>
          ) : null}
        </div>
        <form
          action={isEditing ? updateTeacher : createTeacher}
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {editingTeacher ? (
            <input type="hidden" name="teacherId" value={editingTeacher.id} />
          ) : null}
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {common("name")}
            <input
              name="name"
              defaultValue={editingTeacher?.user.name ?? ""}
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {common("email")}
            <input
              name="email"
              type="email"
              defaultValue={editingTeacher?.user.email ?? ""}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {common("phoneLogin")}
            <input
              name="phone"
              type="tel"
              inputMode="numeric"
              pattern="998[0-9]{9}"
              placeholder="998900000000"
              defaultValue={editingTeacher?.user.phone ?? ""}
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {common("subject")}
            <input
              name="subject"
              defaultValue={editingTeacher?.subject ?? ""}
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {common("password")}
            <input
              name="password"
              type="password"
              required={!isEditing}
              placeholder={isEditing ? "Leave blank to keep current" : "At least 8 characters"}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 sm:col-span-2 lg:col-span-3">
            {common("bio")}
            <textarea
              name="bio"
              rows={3}
              defaultValue={editingTeacher?.bio ?? ""}
              placeholder="A short introduction for the public teacher profile."
              className="mt-1 block w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-800 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300 sm:w-auto"
            >
              {isEditing ? common("saveChanges") : t("teachers.add")}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-slate-950 dark:text-white">Teaching team</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("teachers.search")}
            </p>
          </div>
          <form method="get" className="flex w-full gap-2 sm:w-80">
            <input
              name="search"
              defaultValue={search}
              placeholder={t("teachers.search")}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Search
            </button>
          </form>
        </div>
        {teachers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">{common("teacher")}</th>
                  <th className="px-5 py-4 font-semibold">Subject</th>
                  <th className="px-5 py-4 font-semibold">{common("course")}</th>
                  <th className="px-5 py-4 font-semibold">Contact</th>
                  <th className="px-5 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {teachers.map((teacher) => (
                  <tr key={teacher.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-950 dark:text-white">
                        {teacher.user.name}
                      </p>
                      <p className="mt-1 max-w-xs truncate text-xs text-slate-500 dark:text-slate-400">
                        {teacher.bio ?? "No biography added"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {teacher.subject}
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                      {teacher._count.courses}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                      {teacher.user.email}
                      {teacher.user.phone ? <span className="mt-1 block">{teacher.user.phone}</span> : null}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/teachers?edit=${teacher.id}${editSearch}`}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {common("edit")}
                        </Link>
                        <form action={deleteTeacher.bind(null, teacher.id)}>
                          <ConfirmSubmit
                            action={deleteTeacher.bind(null, teacher.id)}
                            confirmMessage="Delete this teacher? Courses must be reassigned first."
                            label={common("delete")}
                          />
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            {t("teachers.empty")}
          </div>
        )}
      </section>
    </div>
  );
}