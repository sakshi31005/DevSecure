import React, { useState, useEffect } from "react";
import { LIGHT, DARK, sans } from "./theme";
import * as api from "./lib/api";
import {
  generateIdentityKeyPair,
  saveIdentityKeyPair,
  loadIdentityKeyPair,
  exportPublicKeyAsJwk,
} from "./lib/identityCrypto";

import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [mode, setMode] = useState("light");
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(null);
  const [userKeyPair, setUserKeyPair] = useState(null);

  const t = mode === "dark" ? DARK : LIGHT;

  const toggleTheme = () =>
    setMode((m) => (m === "dark" ? "light" : "dark"));

  useEffect(() => {
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  return (
    <div style={{ fontFamily: sans }}>
      {/* Global fonts, animations and accessibility styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap');

        .vault-dial-enter {
          animation: vaultSpinIn 1.1s cubic-bezier(0.16,1,0.3,1) both;
        }

        .vault-needle {
          animation: needleSettle 1.1s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes vaultSpinIn {
          from {
            opacity: 0;
            transform: rotate(-18deg) scale(0.92);
          }
          to {
            opacity: 1;
            transform: rotate(0deg) scale(1);
          }
        }

        @keyframes needleSettle {
          from {
            transform: rotate(-40deg);
          }
          to {
            transform: rotate(0deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .vault-dial-enter,
          .vault-needle {
            animation: none !important;
          }
        }

        button:focus-visible,
        input:focus-visible,
        a:focus-visible {
          outline: 2px solid ${t.accent};
          outline-offset: 2px;
        }
      `}</style>

      {/* Landing Page */}
      {page === "home" && (
        <LandingPage
          t={t}
          mode={mode}
          onToggleTheme={toggleTheme}
          onLogin={() => setPage("auth")}
        />
      )}

      {/* Login / Sign Up Page */}
      {page === "auth" && (
        <AuthPage
          t={t}
          mode={mode}
          onToggleTheme={toggleTheme}
          onBack={() => setPage("home")}
          onAuth={async (email, keyPair) => {
            try {
              // Check whether this browser already has RSA identity keys.
              let persistentKeyPair = await loadIdentityKeyPair(email);

              // Create and save keys for a new browser identity.
              if (!persistentKeyPair) {
                persistentKeyPair =
                  keyPair || (await generateIdentityKeyPair());

                await saveIdentityKeyPair(email, persistentKeyPair);

                // Send only the public key to the backend.
                const publicKeyJwk = await exportPublicKeyAsJwk(
                  persistentKeyPair.publicKey
                );

                await api.updatePublicKey(
                  JSON.stringify(publicKeyJwk)
                );
              }

              setUser(email);
              setUserKeyPair(persistentKeyPair);
              setPage("dashboard");
            } catch (err) {
              console.error("Identity key setup failed:", err);
              alert(
                "Could not set up your encryption keys. Please try again."
              );
            }
          }}
        />
      )}

      {/* User Dashboard */}
      {page === "dashboard" && (
        <Dashboard
          t={t}
          mode={mode}
          onToggleTheme={toggleTheme}
          user={user}
          userKeyPair={userKeyPair}
          onLogout={() => {
            api.clearToken();
            setUser(null);
            setUserKeyPair(null);
            setPage("home");
          }}
        />
      )}
    </div>
  );
}