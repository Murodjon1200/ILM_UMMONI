"use client";

import { useEffect, useState } from "react";

const storageKey = "ilm-ummoni-theme";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const nextIsDark = !isDark;
    document.documentElement.classList.toggle("dark", nextIsDark);
    localStorage.setItem(storageKey, nextIsDark ? "dark" : "light");
    setIsDark(nextIsDark);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/15"
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          isDark ? "bg-amber-300" : "bg-brand-400"
        }`}
        aria-hidden="true"
      />
      {isDark ? "Light" : "Dark"}
    </button>
  );
}
