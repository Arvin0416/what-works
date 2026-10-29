"use client";

import { useEffect, useState } from "react";

type SiteTheme = "day" | "night";

const THEME_STORAGE_KEY = "what-works-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<SiteTheme>("day");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme: SiteTheme = savedTheme === "night" ? "night" : "day";

    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme: SiteTheme = theme === "day" ? "night" : "day";

    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
  }

  return (
    <button
      className="site-header__theme-toggle"
      type="button"
      aria-label={`Switch to ${theme === "day" ? "night" : "day"} theme`}
      aria-pressed={theme === "night"}
      onClick={toggleTheme}
    >
      <span className="site-header__theme-swatch" aria-hidden="true" />
      <span>{theme === "day" ? "Night" : "Day"}</span>
    </button>
  );
}
