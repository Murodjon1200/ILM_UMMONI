"use client";

import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function LoginForm() {
  const t = useTranslations("login");
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    try {
      const formData = new FormData(event.currentTarget);
      const result = await signIn("credentials", {
        phone: formData.get("phone"),
        password: formData.get("password"),
        redirect: false,
      });

      if (result?.error) {
        setError(t("invalid"));
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("error"));
    } finally {
      setIsPending(false);
    }
  }

  const inputClassName =
    "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-brand-400 dark:focus:bg-slate-900";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="phone"
          className="text-sm font-semibold text-slate-700 dark:text-slate-200"
        >
          {t("phone")}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          pattern="998[0-9]{9}"
          autoComplete="tel"
          onChange={(event) => {
            event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
          }}
          placeholder={t("phonePlaceholder")}
          required
          className={inputClassName}
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="text-sm font-semibold text-slate-700 dark:text-slate-200"
        >
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          required
          className={inputClassName}
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-slate-950 px-5 py-3.5 font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-brand-900/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:bg-brand-500 dark:text-slate-950 dark:hover:bg-brand-400"
      >
        {isPending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
