"use client";

import { useTheme } from "@/lib/theme";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const switchingToLight = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={switchingToLight ? "Switch to light theme" : "Switch to dark theme"}
      title={switchingToLight ? "Switch to light theme" : "Switch to dark theme"}
      className={`btn-secondary h-11 w-11 shrink-0 !px-0 ${className}`}
    >
      {switchingToLight ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-ink-200" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.4 5.6l-1.4 1.4M7 17l-1.4 1.4M18.4 18.4L17 17M7 7 5.6 5.6"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-ink-200" aria-hidden="true">
          <path
            fill="currentColor"
            d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"
          />
        </svg>
      )}
    </button>
  );
}
