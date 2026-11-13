import React from "react";
import { Sun, Moon } from "lucide-react";

/**
 * components/ThemeToggle.jsx
 * ---------------------------------------------------------
 * WHAT THIS IS:
 * The light/dark mode switch shown in the top-right corner of
 * every page. Purely visual — it doesn't decide WHAT the colors
 * are (that's theme.js), it just flips which set is active.
 *
 * PROPS:
 * - mode:      "light" or "dark" (which one is currently on)
 * - onToggle:  function to call when clicked
 * - t:         the current theme object (for styling itself)
 * ---------------------------------------------------------
 */
export default function ThemeToggle({ mode, onToggle, t }) {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle color theme"
      className="relative inline-flex items-center rounded-full transition-colors duration-300 focus:outline-none"
      style={{
        width: 52,
        height: 28,
        background: t.surfaceAlt,
        border: `1px solid ${t.border}`,
      }}
    >
      <span
        className="absolute flex items-center justify-center rounded-full transition-transform duration-300"
        style={{
          width: 22,
          height: 22,
          top: 2,
          left: 2,
          background: t.accent,
          transform: mode === "dark" ? "translateX(24px)" : "translateX(0px)",
        }}
      >
        {mode === "dark" ? (
          <Moon size={12} color={t.surface} />
        ) : (
          <Sun size={12} color={t.surface} />
        )}
      </span>
    </button>
  );
}
