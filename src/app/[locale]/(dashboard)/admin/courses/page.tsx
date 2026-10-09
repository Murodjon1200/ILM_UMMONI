import type { Prisma } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { formatSom } from "@/lib/currency";
import { db } from "@/lib/db";

import {
  createCourse,
  deleteCourse,
  updateCourse,
} from "../actions";

export const dynamic = "force-dynamic";

interface CoursesPageProps {
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

function formatDuration(duration: number) {
  const hours = duration / 60;
  return Number.isInteger(hours) ? `${hours} hours` : `${hours.toFixed(1)} hours`;
}

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const t = await getTranslations("admin");
  const common = await getTranslations("common");
  const locale = await getLocale();
  const numberLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ";
  const search = getParam(searchParams.search)?.trim() ?? "";
  const editId = getParam(searchParams.edit);
  const success = getParam(searchParams.success);
  const error = getParam(searchParams.error);

  const where: Prisma.CourseWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { teacher: { user: { name: { contains: search, mode: "insensitive" } } } },
        ],
      }
    : {};

  const [courses, teachers, editingCourse] = await Promise.all([
    db.course.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        teacher: {
          include: {
            user: { select: { name: true } },
          },
        },
        _count: { select: { students: true, schedules: true } },
      },
    }),
    db.teacher.findMany({
      orderBy: { subject: "asc" },
      select: { id: true, subject: true, user: { select: { name: true } } },
    }),
    editId
      ? db.course.findUnique({ where: { id: editId } })
      : null,
  ]);

  const isEditing = Boolean(editingCourse);
  const editSearch = search ? `&search=${encodeURIComponent(search)}` : "";

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-700 dark:text-violet-400">
            {t("nav.courses")}
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {t("courses.title")}
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Manage your course catalog, pricing, duration, and instructors.
          </p>
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {courses.length} {courses.length === 1 ? "course" : "courses"}
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
              {isEditing ? t("courses.edit") : t("courses.add")}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isEditing
                ? "Update the course details and assigned teacher."
                : "Add a new course to the center catalog."}
            </p>
          </div>
          {isEditing ? (
            <Link
              href={`/admin/courses${search ? `?search=${encodeURIComponent(search)}` : ""}`}
              className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-400"
            >
              Cancel edit
            </Link>
          ) : null}
        </div>
        <form
          action={isEditing ? updateCourse : createCourse}
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {editingCourse ? (
            <input type="hidden" name="courseId" value={editingCourse.id} />
          ) : null}
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {common("course")}
            <input
              name="name"
              defaultValue={editingCourse?.name ?? ""}
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {common("teacher")}
            <select
              name="teacherId"
              defaultValue={editingCourse?.teacherId ?? ""}
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="" disabled>
                Select teacher
              </option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.user.name} · {teacher.subject}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {common("price")}
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={editingCourse ? Number(editingCourse.price) : ""}
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {common("duration")}
            <input
              name="duration"
              type="number"
              min="1"
              step="1"
              defaultValue={editingCourse?.duration ?? ""}
              required
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 sm:col-span-2 lg:col-span-3">
            {common("description")}
            <textarea
              name="description"
              rows={3}
              defaultValue={editingCourse?.description ?? ""}
              placeholder="What will students learn in this course?"
              className="mt-1 block w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 dark:bg-violet-400 dark:text-slate-950 dark:hover:bg-violet-300 sm:w-auto"
            >
              {isEditing ? common("saveChanges") : t("courses.add")}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-slate-950 dark:text-white">{t("courses.all")}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("courses.search")}
            </p>
          </div>
          <form method="get" className="flex w-full gap-2 sm:w-80">
            <input
              name="search"
              defaultValue={search}
              placeholder={t("courses.search")}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Search
            </button>
          </form>
        </div>
        {courses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">{common("course")}</th>
                  <th className="px-5 py-4 font-semibold">{common("teacher")}</th>
                  <th className="px-5 py-4 font-semibold">Duration</th>
                  <th className="px-5 py-4 font-semibold">Price</th>
                  <th className="px-5 py-4 font-semibold">Enrollment</th>
                  <th className="px-5 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {courses.map((course) => (
                  <tr key={course.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-950 dark:text-white">
                        {course.name}
                      </p>
                      <p className="mt-1 max-w-xs truncate text-xs text-slate-500 dark:text-slate-400">
                        {course.description ?? "No description added"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {course.teacher.user.name}
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                      {formatDuration(course.duration)}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                      {formatSom(Number(course.price), numberLocale)}
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                      {course._count.students} students · {course._count.schedules} sessions
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/courses?edit=${course.id}${editSearch}`}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {common("edit")}
                        </Link>
                        <form action={deleteCourse.bind(null, course.id)}>
                          <ConfirmSubmit
                            action={deleteCourse.bind(null, course.id)}
                            confirmMessage="Delete this course? Related records may prevent deletion."
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
            {t("courses.empty")}
          </div>
        )}
      </section>
    </div>
  );
}