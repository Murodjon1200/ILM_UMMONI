"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import {
  submitApplication,
  type ContactFormState,
} from "@/app/actions";

interface ContactFormProps {
  courses: Array<{ id: string; name: string }>;
}

const initialState: ContactFormState = {
  status: "idle",
  message: "",
};

const fieldClassName =
  "mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-brand-400 focus:bg-white/15 focus:ring-4 focus:ring-brand-400/10";

export function ContactForm({ courses }: ContactFormProps) {
  const t = useTranslations("landing.contactSection");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<ContactFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const nextState = await submitApplication(formData);
      setState(nextState);

      if (nextState.status === "success") {
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="contact-name"
          className="text-sm font-medium text-slate-200"
        >
          {t("name")}
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Ismingiz va familiyangiz"
          required
          className={fieldClassName}
        />
      </div>
      <div>
        <label
          htmlFor="contact-phone"
          className="text-sm font-medium text-slate-200"
        >
          {t("phone")}
        </label>
        <input
          id="contact-phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          pattern="998[0-9]{9}"
          onChange={(event) => {
            event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
          }}
          autoComplete="tel"
          placeholder="+998 00 000 00 00"
          required
          className={fieldClassName}
        />
      </div>
      <div>
        <label
          htmlFor="contact-course"
          className="text-sm font-medium text-slate-200"
        >
          {t("course")}
        </label>
        <select
          id="contact-course"
          name="courseId"
          defaultValue=""
          required
          className={`${fieldClassName} appearance-none`}
        >
          <option value="" disabled className="bg-slate-900">
            {t("selectCourse")}
          </option>
          {courses.map((course) => (
            <option key={course.id} value={course.id} className="bg-slate-900">
              {course.name}
            </option>
          ))}
        </select>
      </div>
      {state.status !== "idle" ? (
        <p
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.status === "success"
              ? "border-brand-400/30 bg-brand-400/10 text-brand-200"
              : "border-red-300/30 bg-red-300/10 text-red-200"
          }`}
        >
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending || courses.length === 0}
        className="w-full rounded-xl bg-brand-400 px-5 py-3.5 font-semibold text-slate-950 transition hover:bg-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? t("submitting") : t("submit")}
      </button>
      <p className="text-xs leading-5 text-slate-400">
        {t("note")}
      </p>
    </form>
  );
}
