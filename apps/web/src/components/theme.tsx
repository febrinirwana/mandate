"use client";

import { Moon as PhMoon, Sun as PhSun } from "@phosphor-icons/react/dist/ssr";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem("mandate-theme");
    if (stored === "dark" || stored === "light") setTheme(stored);
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      localStorage.setItem("mandate-theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="pressable flex h-9 w-[4.25rem] items-center rounded-[4px] border border-rule bg-raised p-1"
    >
      <span className="relative flex h-full flex-1 items-center" aria-hidden="true">
        <span
          className="absolute top-0 h-7 w-7 rounded-[3px] bg-ink transition-transform duration-300"
          style={{
            transform: dark ? "translateX(calc(100% - 0.25rem))" : "translateX(0)",
            transitionTimingFunction: "var(--ease-drawer)",
          }}
        />
        <span
          className="relative z-10 grid h-7 w-7 place-items-center"
          style={{ color: dark ? "var(--ink-3)" : "var(--paper)" }}
        >
          <PhSun size={15} weight="bold" />
        </span>
        <span
          className="relative z-10 grid h-7 w-7 place-items-center"
          style={{ color: dark ? "var(--paper)" : "var(--ink-3)" }}
        >
          <PhMoon size={15} weight="bold" />
        </span>
      </span>
    </button>
  );
}
