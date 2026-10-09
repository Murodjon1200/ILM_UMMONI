import type { Prisma, StudentStatus } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { db } from "@/lib/db";

import {
  createStudent,
  deleteStudent,
  updateStudent,
} from "../actions";

export const dynamic = "force-dynamic";

interface StudentsPageProps {
  searchParams: {
    edit?: string | string[];
    error?: string | string[];
    search?: string | string[];
    success?: string | string[];
  };
}

const statusStyles: Record<StudentStatus, string> = {
  ACTIVE: "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300",
  INACTIVE: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  COMPLETED: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
  SUSPENDED: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const t = await getTranslations("admin");
  const common = await getTranslations("common");
  const search = getParam(searchParams.search)?.trim() ?? "";
  const editId = getParam(searchParams.edit);
  const success = getParam(searchParams.success);
  const error = getParam(searchParams.error);

  const where: Prisma.StudentWhereInput = search
    ? {
        OR: [
          { user: { name: { contains: search, mode: "insensitive" } } },
          { user: { email: { contains: search, mode: "insensitive" } } },
          { user: { phone: { contains: search, mode: "insensitive" } } },
          { course: { name: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

  const [students, courses, editingStudent] = await Promise.all([
    db.student.findMany({
      where,
      orderBy: { startDate: "asc" },
      include: {
        user: {
          select: { name: true, email: true, phone: true },
        },
        course: {
          select: { id: true, name: true },
        },
      },
    }),
    db.course.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    editId
      ? db.student.findUnique({
          where: { id: editId },
          include: {
            user: {
              select: { name: true, email: true, phone: true },
            },
          },
        })
      : null,
  ]);

  const isEditing = Boolean(editingStudent);
  const editSearch = search ? `&search=${encodeURIComponent(search)}` : "";

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-400">
            {t("nav.students")}
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {t("students.title")}
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Manage student accounts and course enrollments.
          </p>
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {students.length} {students.length === 1 ? "enrollment" : "enrollments"}
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
              {isEditing ? t("students.edit") : t("students.add")}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isEditing
                ? "Update the account and enrollment details."
                : "Create a student account and enroll it in a course."}
            </p>
          </div>
          {isEditing ? (
            <Link
              href={`/admin/students${search ? `?search=${encodeURIComponent(search)}` : ""}`}
              className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400"
            >
              Cancel edit
            </Link>
          ) : null}
        </div>
        <form
          action={isEditing ? updateStudent : createStudent}
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {editingStudent ? (
            <input type="hidden" name="studentId" value={editingStudent.id} />
          ) : null}
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {common("name")}
            <input
              name="name"
              defaultValue={editingStudent?.user.name ?? ""}
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {common("email")}
            <input
              name="email"
              type="email"
              defaultValue={editingStudent?.user.email ?? ""}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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
              defaultValue={editingStudent?.user.phone ?? ""}
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {isEditing ? common("password") : common("password")}
            <input
              name="password"
              type="password"
              required={!isEditing}
              placeholder={isEditing ? "Leave blank to keep current" : "At least 8 characters"}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {common("course")}
            <select
              name="courseId"
              defaultValue={editingStudent?.courseId ?? ""}
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="" disabled>
                Select course
              </option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {common("startDate")}
            <input
              name="startDate"
              type="date"
              defaultValue={editingStudent?.startDate.toISOString().slice(0, 10) ?? ""}
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {common("status")}
            <select
              name="status"
              defaultValue={editingStudent?.status ?? "ACTIVE"}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="ACTIVE">{common("studentActive")}</option>
              <option value="INACTIVE">{common("studentInactive")}</option>
              <option value="COMPLETED">{common("studentCompleted")}</option>
              <option value="SUSPENDED">{common("studentSuspended")}</option>
            </select>
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 dark:bg-brand-400 dark:text-slate-950 dark:hover:bg-brand-300"
            >
              {isEditing ? common("saveChanges") : t("students.add")}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-slate-950 dark:text-white">All students</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("students.search")}
            </p>
          </div>
          <form method="get" className="flex w-full gap-2 sm:w-80">
            <input
              name="search"
              defaultValue={search}
              placeholder={t("students.search")}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {common("search")}
            </button>
          </form>
        </div>
        {students.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">{common("student")}</th>
                  <th className="px-5 py-4 font-semibold">{common("course")}</th>
                  <th className="px-5 py-4 font-semibold">{common("startDate")}</th>
                  <th className="px-5 py-4 font-semibold">{common("status")}</th>
                  <th className="px-5 py-4 text-right font-semibold">{common("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((student) => (
                  <tr key={student.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-950 dark:text-white">
                        {student.user.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {student.user.email}
                        {student.user.phone ? ` · ${student.user.phone}` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {student.course.name}
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                      {formatDate(student.startDate)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[student.status]}`}>
                        {student.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/students?edit=${student.id}${editSearch}`}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {common("edit")}
                        </Link>
                        <form action={deleteStudent.bind(null, student.id)}>
                          <ConfirmSubmit
                            action={deleteStudent.bind(null, student.id)}
                            confirmMessage="Delete this student enrollment? This cannot be undone."
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
            {t("students.empty")}
          </div>
        )}
      </section>
    </div>
  );
}