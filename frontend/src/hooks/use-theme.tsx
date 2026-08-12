import { useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "dq_theme";

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readPreference(): ThemePreference {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  // No stored preference yet → follow the OS, matching the prior default.
  return "system";
}

function resolve(pref: ThemePreference): ResolvedTheme {
  return pref === "system" ? systemTheme() : pref;
}

function apply(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

/**
 * Theme hook.
 *
 * Backwards compatible: existing callers keep using `theme` (the *resolved*
 * light/dark actually shown) and `toggleTheme` (flips to the opposite explicit
 * theme). New callers can read/set `preference` to also choose "system", which
 * genuinely follows the OS `prefers-color-scheme` and live-updates when it
 * changes. The choice persists in localStorage under "dq_theme"; a cross-tab /
 * cross-component "dq-theme-updated" event keeps every mounted hook in sync.
 */
export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>("light");
  const [theme, setTheme] = useState<ResolvedTheme>("light");

  // Initialise from storage on mount (client only).
  useEffect(() => {
    const pref = readPreference();
    const resolved = resolve(pref);
    setPreferenceState(pref);
    setTheme(resolved);
    apply(resolved);
  }, []);

  // Re-sync when another component/tab changes the preference, and when the OS
  // theme changes while we're in "system" mode.
  useEffect(() => {
    const sync = () => {
      const pref = readPreference();
      const resolved = resolve(pref);
      setPreferenceState(pref);
      setTheme(resolved);
      apply(resolved);
    };
    window.addEventListener("dq-theme-updated", sync);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (readPreference() === "system") sync();
    };
    mq.addEventListener("change", onSystemChange);

    return () => {
      window.removeEventListener("dq-theme-updated", sync);
      mq.removeEventListener("change", onSystemChange);
    };
  }, []);

  const setPreference = (pref: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, pref);
    const resolved = resolve(pref);
    setPreferenceState(pref);
    setTheme(resolved);
    apply(resolved);
    window.dispatchEvent(new Event("dq-theme-updated"));
  };

  // Flip to the opposite of what's currently shown, pinning it explicitly.
  const toggleTheme = () => setPreference(theme === "light" ? "dark" : "light");

  return { theme, preference, setPreference, toggleTheme };
}
