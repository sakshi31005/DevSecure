import React from "react";
import { mono } from "../theme";

/**
 * components/VaultDial.jsx
 * ---------------------------------------------------------
 * WHAT THIS IS:
 * The circular "combination lock" illustration on the right
 * side of the landing page hero. It's a plain SVG — a few
 * concentric circles, tick marks around the edge, and a needle
 * — with a one-time rotate-in animation defined in App.jsx's
 * global <style> block (class names "vault-dial-enter" and
 * "vault-needle").
 *
 * This has no logic and no props besides the theme — it's
 * purely decorative, so feel free to redesign this file freely
 * without worrying about breaking anything else.
 *
 * PROPS:
 * - t: current theme object (for colors)
 * ---------------------------------------------------------
 */
export default function VaultDial({ t }) {
  const ticks = Array.from({ length: 24 });

  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      height="100%"
      className="vault-dial-enter"
      style={{ maxWidth: 340 }}
    >
      <circle cx="160" cy="160" r="140" fill="none" stroke={t.border} strokeWidth="1.5" />
      <circle cx="160" cy="160" r="112" fill={t.surfaceAlt} stroke={t.border} strokeWidth="1.5" />

      {ticks.map((_, i) => {
        const angle = (i / ticks.length) * 2 * Math.PI;
        const isMajor = i % 6 === 0;
        const r1 = isMajor ? 122 : 128;
        const r2 = 140;
        const x1 = 160 + r1 * Math.cos(angle);
        const y1 = 160 + r1 * Math.sin(angle);
        const x2 = 160 + r2 * Math.cos(angle);
        const y2 = 160 + r2 * Math.sin(angle);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isMajor ? t.accent : t.textMuted}
            strokeWidth={isMajor ? 2.5 : 1}
            opacity={isMajor ? 1 : 0.5}
          />
        );
      })}

      <circle cx="160" cy="160" r="78" fill={t.surface} stroke={t.border} strokeWidth="1.5" />

      <g className="vault-needle" style={{ transformOrigin: "160px 160px" }}>
        <line x1="160" y1="160" x2="160" y2="96" stroke={t.accent} strokeWidth="3" strokeLinecap="round" />
        <circle cx="160" cy="160" r="7" fill={t.accent} />
      </g>

      <foreignObject x="120" y="184" width="80" height="40">
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            fontFamily: mono,
            fontSize: 10,
            letterSpacing: 1,
            color: t.textMuted,
            textAlign: "center",
          }}
        >
          AES · 256
        </div>
      </foreignObject>
    </svg>
  );
}
