import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { ContactForm } from "@/components/landing/contact-form";
import { Navbar } from "@/components/landing/navbar";
import { formatSom } from "@/lib/currency";
import { db } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");

  return {
    title: t("headline"),
    description: t("subtext"),
  };
}

export const dynamic = "force-dynamic";

const centerStatKeys = ["students", "teachers", "courses", "experience"] as const;
const featureKeys = ["professional", "modern", "schedule", "certificate"] as const;

const courseVisuals = [
  { accent: "bg-brand-400", surface: "from-brand-500/30 via-brand-950/40 to-[#060b0a]" },
  { accent: "bg-amber-400", surface: "from-amber-500/25 via-amber-950/40 to-[#060b0a]" },
  { accent: "bg-violet-400", surface: "from-violet-500/25 via-violet-950/40 to-[#060b0a]" },
];

const contactDetails = {
  address:
    process.env.NEXT_PUBLIC_CENTER_ADDRESS ?? "Toshkent, Oʻzbekiston",
  email: "admin@ilmummoni.uz",
  phone: process.env.NEXT_PUBLIC_CENTER_PHONE ?? "+998 __ ___ __ __",
};

function formatDuration(duration: number) {
  const hours = duration / 60;
  return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function HomePage() {
  const t = await getTranslations("landing");
  const navT = await getTranslations("nav");
  const commonT = await getTranslations("common");
  const locale = await getLocale();
  const numberLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ";
  const [courses, teachers] = await Promise.all([
    db.course.findMany({
      orderBy: { name: "asc" },
      take: 8,
    }),
    db.teacher.findMany({
      orderBy: { subject: "asc" },
      take: 4,
      include: {
        user: { select: { name: true } },
      },
    }),
  ]);

  const courseOptions = courses.map((course) => ({
    id: course.id,
    name: course.name,
  }));

  return (
    <main className="overflow-hidden bg-[#060b0a] text-white">
      <Navbar />

      <section
        id="home"
        className="relative isolate flex min-h-screen items-center overflow-hidden pb-20 pt-32"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_78%_18%,rgba(0,132,255,0.22),transparent_30%),radial-gradient(circle_at_12%_85%,rgba(34,211,238,0.1),transparent_28%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:64px_64px]"
        />

        <div className="mx-auto grid w-full max-w-7xl gap-16 px-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-400/20 bg-brand-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-brand-300">
              <span className="h-2 w-2 rounded-full bg-brand-300 shadow-[0_0_16px_rgba(0,198,255,0.9)]" />
              {t("badge")}
            </div>
            <h1 className="mt-8 text-5xl font-semibold leading-[0.98] tracking-[-0.05em] text-white sm:text-6xl lg:text-8xl">
              {t("headline")}
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              {t("subtext")}
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a
                href="#courses"
                className="inline-flex items-center justify-center rounded-full bg-brand-400 px-7 py-4 text-sm font-bold text-slate-950 shadow-xl shadow-brand-500/10 transition hover:-translate-y-0.5 hover:bg-brand-300"
              >
                {t("coursesCta")}
              </a>
              <a
                href="#contact"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-4 text-sm font-bold text-white backdrop-blur transition hover:border-brand-400/40 hover:bg-brand-400/10"
              >
                {t("registerCta")}
              </a>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-400">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                {t("practical")}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {t("schedule")}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                {t("certificate")}
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:ml-auto">
            <div className="absolute -inset-8 rounded-[3rem] bg-brand-400/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/50 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-2 pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {commonT("brand")}
                  </p>
                  <p className="mt-1 font-semibold">{t("coursesSection.eyebrow")}</p>
                </div>
                <span className="rounded-full border border-brand-400/20 bg-brand-400/10 px-3 py-1.5 text-[11px] font-semibold text-brand-300">
                  Ochiq
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  [t("coursesSection.eyebrow"), t("coursesSection.description"), "w-4/5", "bg-brand-400"],
                  [navT("teachers"), t("teachersSection.description"), "w-3/5", "bg-amber-400"],
                  [t("why.title"), t("why.modernDescription"), "w-5/6", "bg-violet-400"],
                ].map(([title, description, width, color]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {description}
                        </p>
                      </div>
                      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${width} ${color}`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-brand-400 p-5 text-slate-950">
                <p className="text-3xl font-black">{t("stats.students.value")}</p>
                <p className="mt-1 text-sm font-semibold">
                  {t("stats.students.label")}
                </p>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-xl backdrop-blur sm:block">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                {t("stats.experience.label")}
              </p>
              <p className="mt-1 text-2xl font-black text-brand-400">
                {t("stats.experience.value")} {t("stats.experience.label")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-6 lg:grid-cols-4 lg:px-8">
          {centerStatKeys.map((key) => (
            <div key={key} className="px-4 py-10 text-center sm:py-12">
              <p className="text-3xl font-black tracking-tight text-brand-400 sm:text-4xl">
                {t(`stats.${key}.value`)}
              </p>
              <p className="mt-2 text-sm font-semibold text-white">{t(`stats.${key}.label`)}</p>
              <p className="mt-1 text-xs text-slate-500">{t(`stats.${key}.detail`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="courses" className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-400">
              {t("coursesSection.eyebrow")}
            </p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {t("coursesSection.title")}
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-slate-400">
            {t("coursesSection.description")}
          </p>
        </div>

        {courses.length > 0 ? (
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course, index) => {
              const visual = courseVisuals[index % courseVisuals.length];

              return (
                <article
                  key={course.id}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] transition hover:-translate-y-1 hover:border-brand-400/30 hover:shadow-2xl hover:shadow-brand-500/5"
                >
                  <div
                    className={`relative h-48 overflow-hidden bg-gradient-to-br ${visual.surface} p-6`}
                  >
                    <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full border border-white/10" />
                    <div className="absolute -right-1 top-8 h-24 w-24 rounded-full border border-white/10" />
                    <span className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                      {t("coursesSection.eyebrow")}
                    </span>
                    <div className={`absolute inset-x-0 bottom-0 h-1 ${visual.accent}`} />
                  </div>
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-xl font-bold">{course.name}</h3>
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-brand-300">
                        {formatDuration(course.duration)} {t("coursesSection.duration")}
                      </span>
                    </div>
                    <p className="mt-4 min-h-[4.5rem] text-sm leading-6 text-slate-400">
                      {course.description ?? t("coursesSection.description")}
                    </p>
                    <div className="mt-6 flex items-end justify-between gap-4 border-t border-white/10 pt-5">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-500">
                          {t("coursesSection.price")}
                        </p>
                        <p className="mt-1 font-bold text-white">
                          {formatSom(Number(course.price), numberLocale)}
                        </p>
                      </div>
                      <a
                        href="#contact"
                        className="rounded-full bg-brand-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-brand-300"
                      >
                        {t("coursesSection.register")}
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-14 rounded-3xl border border-dashed border-white/15 p-12 text-center">
            <p className="font-semibold">{t("coursesSection.empty")}</p>
            <p className="mt-2 text-sm text-slate-500">
              {t("coursesSection.empty")}
            </p>
          </div>
        )}
      </section>

      <section id="teachers" className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-400">
              {t("teachersSection.eyebrow")}
            </p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {t("teachersSection.title")}
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-400">
              {t("teachersSection.description")}
            </p>
          </div>

          {teachers.length > 0 ? (
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {teachers.map((teacher) => (
                <article
                  key={teacher.id}
                  className="rounded-3xl border border-white/10 bg-[#060b0a] p-6 transition hover:-translate-y-1 hover:border-amber-400/30"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-400 text-sm font-black tracking-wider text-slate-950">
                    {getInitials(teacher.user.name)}
                  </div>
                  <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
                    {teacher.subject}
                  </p>
                  <h3 className="mt-2 text-xl font-bold">{teacher.user.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {teacher.bio ?? t("teachersSection.description")}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-14 rounded-3xl border border-dashed border-white/15 p-12 text-center">
              <p className="font-semibold">{t("teachersSection.empty")}</p>
              <p className="mt-2 text-sm text-slate-500">
                {t("teachersSection.empty")}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-400">
            {t("why.eyebrow")}
          </p>
          <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            {t("why.title")}
          </h2>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featureKeys.map((key, index) => (
            <article
              key={key}
              className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition hover:border-brand-400/30"
            >
              <p className="text-sm font-black tracking-[0.2em] text-brand-400">
                0{index + 1}
              </p>
              <h3 className="mt-8 text-xl font-bold">{t(`why.${key}`)}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {t(`why.${key}Description`)}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="border-t border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-14 px-6 py-24 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:px-8 lg:py-32">
          <div className="lg:sticky lg:top-32">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-400">
              {t("contactSection.eyebrow")}
            </p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {t("contactSection.title")}
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-400">
              {t("contactSection.description")}
            </p>
            <div className="mt-10 space-y-4 text-sm text-slate-300">
              <p className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                {t("why.professional")}
              </p>
              <p className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                {t("why.modern")}
              </p>
              <p className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-400" />
                {t("why.schedule")}
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#060b0a] p-6 shadow-2xl shadow-black/30 sm:p-9">
            <h3 className="text-2xl font-semibold">{t("contactSection.formTitle")}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {t("contactSection.formDescription")}
            </p>
            <div className="mt-8">
              <ContactForm courses={courseOptions} />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#060b0a]">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_1fr] lg:px-8">
          <div>
            <p className="text-sm font-black tracking-[0.3em] text-brand-400">
              {commonT("brand")}
            </p>
            <p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">
              {t("footer.description")}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{t("footer.quickLinks")}</p>
            <div className="mt-5 flex flex-col gap-3 text-sm text-slate-400">
              <a href="#home" className="transition hover:text-brand-400">{navT("home")}</a>
              <a href="#courses" className="transition hover:text-brand-400">{navT("courses")}</a>
              <a href="#teachers" className="transition hover:text-brand-400">{navT("teachers")}</a>
              <Link href="/login" className="transition hover:text-brand-400">{commonT("signIn")}</Link>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{t("footer.contact")}</p>
            <div className="mt-5 space-y-3 text-sm text-slate-400">
              <p>{contactDetails.phone}</p>
              <p>{contactDetails.address}</p>
              <a href={`mailto:${contactDetails.email}`} className="block transition hover:text-brand-400">
                {contactDetails.email}
              </a>
            </div>
            <div className="mt-6 flex gap-3">
              {[
                ["Instagram", "M5 8h14v11H5zM9 3h6v3H9z"],
                ["Telegram", "M3 11l18-8-7 18-3-7-8-3z"],
                ["Facebook", "M13 22v-8h3l1-4h-4V8c0-1 0-2 2-2h2V2h-3c-3 0-4 2-4 4v4H7v4h3v8"],
              ].map(([label, path]) => (
                <span
                  key={label}
                  title={label}
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
                    <path d={path} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <span>© {new Date().getFullYear()} Ilm Ummoni. {t("footer.rights")}</span>
            <span>{t("headline")}</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
