import React from "react";
import { ShieldCheck, KeyRound, Lock, ChevronRight } from "lucide-react";
import { serif, sans } from "../theme";
import Brand from "../components/Brand";
import ThemeToggle from "../components/ThemeToggle";
import VaultDial from "../components/VaultDial";

/**
 * pages/LandingPage.jsx
 * ---------------------------------------------------------
 * WHAT THIS IS:
 * The very first screen — nav bar, hero ("Your things, safe
 * with us."), the 3-step "how it works" section, and the
 * "why it matters" section. No login here; the login button
 * just tells App.jsx to switch to the auth page.
 *
 * PROPS:
 * - t:              current theme object
 * - mode:           "light" or "dark"
 * - onToggleTheme:  flips the theme
 * - onLogin:        called when "Log in" / "Get started" is clicked
 *                    (App.jsx uses this to navigate to the login page)
 *
 * TO EDIT COPY:
 * The headline is the <h1> text below. The 3 steps and the
 * 3 "why it matters" rows are the `steps` and `rows` arrays
 * right below — edit the title/body text there.
 * ---------------------------------------------------------
 */
export default function LandingPage({ t, mode, onToggleTheme, onLogin }) {
  const steps = [
    {
      title: "Lock it",
      body: "Your file is encrypted on your own device before it ever leaves the browser.",
    },
    {
      title: "Wrap the key",
      body: "The one-time key that unlocks your file gets sealed with the recipient's public key.",
    },
    {
      title: "Share safely",
      body: "Only the person you chose can unwrap the key and open the file. We can't.",
    },
  ];

  const rows = [
    {
      icon: <ShieldCheck size={18} color={t.accent} />,
      title: "Zero-knowledge storage",
      body: "Our servers hold locked boxes, never the contents. A breach exposes nothing readable.",
    },
    {
      icon: <KeyRound size={18} color={t.accent} />,
      title: "A fresh key per file",
      body: "Every upload gets its own encryption key, so no single leak ever unlocks everything else.",
    },
    {
      icon: <Lock size={18} color={t.accent} />,
      title: "Nothing to trust but math",
      body: "Access isn't a promise we make — it's a key you hold. That's the whole security model.",
    },
  ];

  return (
    <div style={{ background: t.bg, color: t.text, fontFamily: sans, minHeight: "100vh" }}>
      {/* --- Nav bar --- */}
      <nav className="flex items-center justify-between px-6 py-5 md:px-12">
        <Brand t={t} />
        <div className="flex items-center gap-4">
          <ThemeToggle mode={mode} onToggle={onToggleTheme} t={t} />
          <button
            onClick={onLogin}
            className="rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200"
            style={{ background: t.accent, color: t.surface }}
          >
            Log in
          </button>
        </div>
      </nav>

      {/* --- Hero --- */}
      <section className="px-6 md:px-12 pt-10 pb-20 md:pt-16 md:pb-28">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-14 items-center">
          <div>
            <h1
              style={{ fontFamily: serif, fontWeight: 600, lineHeight: 1.08, color: t.text }}
              className="text-4xl md:text-6xl mb-6"
            >
              Your things, safe with us.
            </h1>
            <p className="text-base md:text-lg mb-9 max-w-md" style={{ color: t.textMuted, lineHeight: 1.6 }}>
              DevSecure encrypts every file in your browser before it's ever uploaded.
              We store the locked box. You and whoever you share it with hold the only keys.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={onLogin}
                className="rounded-full px-7 py-3 text-sm font-medium transition-transform duration-200 hover:scale-[1.02]"
                style={{ background: t.accent, color: t.surface }}
              >
                Get started
              </button>
              <a href="#how-it-works" className="flex items-center gap-1 text-sm font-medium" style={{ color: t.text }}>
                See how it works <ChevronRight size={16} />
              </a>
            </div>
          </div>
          <div className="flex justify-center">
            <VaultDial t={t} />
          </div>
        </div>
      </section>

      {/* --- How it works (3-step sequence) --- */}
      <section id="how-it-works" className="px-6 md:px-12 py-16" style={{ background: t.bgAlt }}>
        <div className="max-w-5xl mx-auto">
          <h2 style={{ fontFamily: serif, fontWeight: 600 }} className="text-2xl md:text-3xl mb-12">
            How a file gets shared
          </h2>
          <div className="grid md:grid-cols-3 gap-10 relative">
            <div className="hidden md:block absolute left-0 right-0" style={{ top: 18, height: 1, background: t.border }} />
            {steps.map((s, i) => (
              <div key={s.title} className="relative">
                <div
                  className="flex items-center justify-center rounded-full mb-5 relative z-10"
                  style={{
                    width: 36,
                    height: 36,
                    background: t.surface,
                    border: `2px solid ${t.accent}`,
                    color: t.accent,
                    fontFamily: serif,
                    fontWeight: 600,
                  }}
                >
                  {i + 1}
                </div>
                <h3 style={{ fontFamily: serif, fontWeight: 600 }} className="text-lg mb-2">
                  {s.title}
                </h3>
                <p style={{ color: t.textMuted, lineHeight: 1.6 }} className="text-sm max-w-xs">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Why it matters (ledger rows) --- */}
      <section className="px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 style={{ fontFamily: serif, fontWeight: 600 }} className="text-2xl md:text-3xl mb-10">
            Why it matters
          </h2>
          <div style={{ borderTop: `1px solid ${t.border}` }}>
            {rows.map((r) => (
              <div key={r.title} className="flex gap-4 py-6" style={{ borderBottom: `1px solid ${t.border}` }}>
                <div
                  className="flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ width: 40, height: 40, background: t.accentSoft }}
                >
                  {r.icon}
                </div>
                <div>
                  <h3 className="text-base font-semibold mb-1" style={{ color: t.text }}>
                    {r.title}
                  </h3>
                  <p className="text-sm" style={{ color: t.textMuted, lineHeight: 1.6 }}>
                    {r.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer
        className="px-6 md:px-12 py-10 flex flex-col md:flex-row items-center justify-between gap-4"
        style={{ borderTop: `1px solid ${t.border}` }}
      >
        <Brand t={t} size={14} />
        <p className="text-sm" style={{ color: t.textMuted }}>
          Encrypted in your browser. Read by no one else.
        </p>
      </footer>
    </div>
  );
}
