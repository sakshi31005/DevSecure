import React from "react";
import { Lock } from "lucide-react";
import { serif } from "../theme";

/**
 * components/Brand.jsx
 * ---------------------------------------------------------
 * WHAT THIS IS:
 * The little lock-icon + "DevSecure" wordmark shown in the
 * nav bar on every page.
 *
 * PROPS:
 * - t:     current theme object (for colors)
 * - size:  icon size in px (defaults to 20; footer uses smaller)
 * ---------------------------------------------------------
 */
export default function Brand({ t, size = 20 }) {
  return (
    <div className="flex items-center gap-2 select-none">
      <span
        className="flex items-center justify-center rounded-lg"
        style={{ width: size + 14, height: size + 14, background: t.accent }}
      >
        <Lock size={size} color={t.surface} strokeWidth={2.25} />
      </span>
      <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 19, color: t.text }}>
        DevSecure
      </span>
    </div>
  );
}
