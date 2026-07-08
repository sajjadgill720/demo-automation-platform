import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dq_theme");
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = stored === "dark" || (!stored && systemDark) ? "dark" : "light";

      setTheme(initial);
      if (initial === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("dq_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("dq_theme", "light");
    }
    window.dispatchEvent(new Event("dq-theme-updated"));
  };

  useEffect(() => {
    const handleThemeUpdate = () => {
      const current = document.documentElement.classList.contains("dark") ? "dark" : "light";
      setTheme(current);
    };
    window.addEventListener("dq-theme-updated", handleThemeUpdate);
    return () => window.removeEventListener("dq-theme-updated", handleThemeUpdate);
  }, []);

  return { theme, toggleTheme };
}
