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
/**
 * App.jsx
 * ---------------------------------------------------------
 * WHAT THIS IS:
 * The "traffic controller" for the whole app. It doesn't
 * render any actual page content itself — it just:
 *   1. Holds the state that needs to survive across pages
 *      (which theme, which page, who's logged in, their keys)
 *   2. Decides which ONE page component to show
 *   3. Passes down the functions each page needs to move
 *      to the next page (e.g. onLogin, onBack, onAuth)
 *
 * REAL AUTH FLOW (post-backend wiring):
 *   AuthPage calls the backend, gets a JWT, then calls
 *   onAuth(email, keyPair). App.jsx stores those and
 *   switches to the Dashboard. On logout, the JWT is
 *   cleared and we go back to the landing page.
 *
 *   NOTE: The user's RSA identity key pair is persisted in
 *   this browser's localStorage so the same identity can be
 *   used after refreshing or logging in again. The private key
 *   never leaves the user's browser or gets sent to the backend.
 *
 *   For this college project, localStorage is used for simplicity.
 *   In a production application, the private key should be
 *   protected with stronger secure storage or encryption.
 * 
 * 
 * If you want to see how a specific screen looks or works,
 * go straight to:
 *   src/pages/LandingPage.jsx
 *   src/pages/AuthPage.jsx
 *   src/pages/Dashboard.jsx
 * ---------------------------------------------------------
 */
export default function App() {
  const [mode, setMode] = useState("light");  // "light" | "dark"
  const [page, setPage] = useState("home");   // "home" | "auth" | "dashboard"
  const [practiceMode, setPracticeMode] = useState(true);
  const [user, setUser] = useState(null);     // logged-in user's email
  const [userKeyPair, setUserKeyPair] = useState(null); // { publicKey, privateKey } — RSA CryptoKeys

  const t = mode === "dark" ? DARK : LIGHT;
  const toggleTheme = () => setMode((m) => (m === "dark" ? "light" : "dark"));

  useEffect(() => {
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  return (
    <div style={{ fontFamily: sans }}>

      {practiceMode ? (
        <div>
          <button
            onClick={() => setPracticeMode(false)}
            style={{ margin: "16px", padding: "8px" }}
          >
            Back to devSecure
          </button>


        </div>
      ) : (
        <>
          {/* Global font import + one-time hero animation + focus outlines.
          Everything here is app-wide, which is why it lives here and
          not inside any single page. */}
          <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap');

        .vault-dial-enter { animation: vaultSpinIn 1.1s cubic-bezier(0.16,1,0.3,1) both; }
        .vault-needle { animation: needleSettle 1.1s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes vaultSpinIn {
          from { opacity: 0; transform: rotate(-18deg) scale(0.92); }
          to { opacity: 1; transform: rotate(0deg) scale(1); }
        }
        @keyframes needleSettle {
          from { transform: rotate(-40deg); }
          to { transform: rotate(0deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .vault-dial-enter, .vault-needle { animation: none !important; }
        }
        button:focus-visible, input:focus-visible, a:focus-visible {
          outline: 2px solid ${t.accent};
          outline-offset: 2px;
        }
      `}</style>

          {page === "home" && (
            <LandingPage t={t} mode={mode} onToggleTheme={toggleTheme} onLogin={() => setPage("auth")} />
          )}

          {page === "auth" && (
            <AuthPage
              t={t}
              mode={mode}
              onToggleTheme={toggleTheme}
              onBack={() => setPage("home")}
              // AuthPage handles the backend call itself.
              // It calls onAuth(email, keyPair) after the JWT is stored.
              onAuth={async (email, keyPair) => {
                try {
                  // Check whether this browser already has this user's RSA keys.
                  let persistentKeyPair = await loadIdentityKeyPair(email);

                  // If this is the first time, use the new key pair and save it.
                  if (!persistentKeyPair) {
                    persistentKeyPair = keyPair || await generateIdentityKeyPair();

                    await saveIdentityKeyPair(email, persistentKeyPair);

                    // Update the backend with this user's public key.
                    const publicKeyJwk = await exportPublicKeyAsJwk(
                      persistentKeyPair.publicKey
                    );

                    await api.updatePublicKey(JSON.stringify(publicKeyJwk));
                  }

                  setUser(email);
                  setUserKeyPair(persistentKeyPair);
                  setPage("dashboard");
                } catch (err) {
                  console.error("Identity key setup failed:", err);
                  alert("Could not set up your encryption keys. Please try again.");
                }
              }}
            />
          )}

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
        </>
      )}
    </div>
  );
}
