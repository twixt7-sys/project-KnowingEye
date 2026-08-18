import { Moon, Sun } from "@/shared/icons";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * Reads/writes theme through next-themes (`core/providers/theme-provider.tsx`)
 * instead of touching `<html>`'s class list directly - a previous version
 * did that independently, which fought the provider and defaulted every
 * first-time visitor to dark. See Directive Area 02 ("Tone & theme").
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // Avoid a hydration mismatch: resolvedTheme is undefined until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  return (
    <button
      onClick={toggleTheme}
      className={`rounded-md border border-border bg-card p-2 transition-colors hover:bg-accent ${className}`}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
