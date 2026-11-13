import React, { useState } from "react";
import { Lock, Eye, EyeOff, ArrowLeft, Loader } from "lucide-react";
import { serif, sans } from "../theme";
import ThemeToggle from "../components/ThemeToggle";

import {
  generateIdentityKeyPair,
  exportPublicKeyAsJwk,
  saveIdentityKeyPair,
  loadIdentityKeyPair,
} from "../lib/identityCrypto";

import * as api from "../lib/api";

/**
 * pages/AuthPage.jsx
 * ---------------------------------------------------------
 * Authentication + persistent RSA identity keys.
 *
 * SIGNUP:
 * 1. Generate a new RSA public/private key pair.
 * 2. Save the key pair in this browser.
 * 3. Send only the public key to the backend.
 *
 * LOGIN:
 * 1. Load the existing RSA key pair from this browser.
 * 2. Send the existing public key to the backend.
 * 3. Keep the private key in memory for this session.
 *
 * The private key is never sent to the backend.
 * ---------------------------------------------------------
 */

export default function AuthPage({
  t,
  mode,
  onToggleTheme,
  onBack,
  onAuth,
}) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();

    // Client-side validation
    if (!email.trim() || !password.trim()) {
      setError("Enter an email and password to continue.");
      return;
    }

    if (isSignup && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    setError("");
    setLoading(true);

    try {
      let keyPair;
      let publicKeyJwk;
      let result;

      // ==================================================
      // SIGNUP: Create and save a brand-new identity
      // ==================================================
      if (isSignup) {
        keyPair = await generateIdentityKeyPair();

        // Save the SAME key pair for future logins
        await saveIdentityKeyPair(cleanEmail, keyPair);

        // Only the public key goes to the backend
        publicKeyJwk = await exportPublicKeyAsJwk(keyPair.publicKey);

        result = await api.signup(
          cleanEmail,
          password,
          publicKeyJwk
        );
      }

      // ==================================================
      // LOGIN: Load the existing identity
      // ==================================================
      else {
        keyPair = await loadIdentityKeyPair(cleanEmail);

        // If this browser does not have the old key pair,
        // we cannot decrypt files encrypted with that identity.
        if (!keyPair) {
          throw new Error(
            "Your secure identity key was not found in this browser. Please use the browser/device where you created your account."
          );
        }

        publicKeyJwk = await exportPublicKeyAsJwk(keyPair.publicKey);

        result = await api.login(
          cleanEmail,
          password,
          publicKeyJwk
        );
      }

      // Store JWT for authenticated API requests
      api.setToken(result.token);

      // Send email and SAME key pair to App.jsx
      onAuth(cleanEmail, keyPair);

    } catch (err) {
      setError(
        err.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: t.bg,
        color: t.text,
        fontFamily: sans,
        minHeight: "100vh",
      }}
      className="flex flex-col"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-5 md:px-12">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: t.textMuted }}
        >
          <ArrowLeft size={16} /> Back to home
        </button>

        <ThemeToggle
          mode={mode}
          onToggle={onToggleTheme}
          t={t}
        />
      </div>

      {/* Authentication card */}
      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div
          className="w-full"
          style={{
            maxWidth: 400,
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 20,
            padding: "40px 36px",
            boxShadow: `0 20px 40px -20px ${
              mode === "dark"
                ? "rgba(0,0,0,0.5)"
                : "rgba(150,96,47,0.18)"
            }`,
          }}
        >
          <div
            className="flex items-center justify-center rounded-xl mb-6"
            style={{
              width: 44,
              height: 44,
              background: t.accentSoft,
            }}
          >
            <Lock size={20} color={t.accent} />
          </div>

          <h1
            style={{
              fontFamily: serif,
              fontWeight: 600,
            }}
            className="text-2xl mb-2"
          >
            {isSignup ? "Create your vault" : "Welcome back"}
          </h1>

          <p
            className="text-sm mb-7"
            style={{ color: t.textMuted }}
          >
            {isSignup
              ? "Set up an account to start encrypting files."
              : "Log in to open your vault."}
          </p>

          <form
            onSubmit={submit}
            className="flex flex-col gap-4"
          >
            {/* Email */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: t.textMuted }}
              >
                Email
              </label>

              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm focus:outline-none transition-colors"
                style={{
                  background: t.surfaceAlt,
                  border: `1px solid ${t.border}`,
                  color: t.text,
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: t.textMuted }}
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full rounded-lg px-3.5 py-2.5 pr-10 text-sm focus:outline-none transition-colors"
                  style={{
                    background: t.surfaceAlt,
                    border: `1px solid ${t.border}`,
                    color: t.text,
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((s) => !s)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: t.textMuted }}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p
                className="text-sm"
                style={{ color: t.danger }}
              >
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              id="auth-submit"
              type="submit"
              disabled={loading}
              className="w-full rounded-full py-2.5 text-sm font-medium mt-2 transition-transform duration-200 hover:scale-[1.01] flex items-center justify-center gap-2"
              style={{
                background: t.accent,
                color: t.surface,
                opacity: loading ? 0.75 : 1,
              }}
            >
              {loading && (
                <Loader
                  size={14}
                  className="animate-spin"
                />
              )}

              {loading
                ? isSignup
                  ? "Creating your secure identity…"
                  : "Opening your vault…"
                : isSignup
                ? "Create account"
                : "Log in"}
            </button>
          </form>

          {/* Switch signup/login */}
          <p
            className="text-center text-sm mt-6"
            style={{ color: t.textMuted }}
          >
            {isSignup
              ? "Already have an account?"
              : "New here?"}{" "}

            <button
              onClick={() => {
                setIsSignup((s) => !s);
                setError("");
              }}
              disabled={loading}
              className="font-medium underline"
              style={{ color: t.accent }}
            >
              {isSignup ? "Log in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}