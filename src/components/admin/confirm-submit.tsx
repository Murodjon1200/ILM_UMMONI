"use client";

import type { MouseEvent } from "react";

interface ConfirmSubmitProps {
  action: (formData: FormData) => void | Promise<void>;
  confirmMessage: string;
  label: string;
  variant?: "danger" | "secondary";
}

export function ConfirmSubmit({
  action,
  confirmMessage,
  label,
  variant = "danger",
}: ConfirmSubmitProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  }

  const variantClassName =
    variant === "danger"
      ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

  return (
    <button
      type="submit"
      formAction={action}
      onClick={handleClick}
      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${variantClassName}`}
    >
      {label}
    </button>
  );
}
