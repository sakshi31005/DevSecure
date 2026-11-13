# DevSecure

A zero-knowledge file-sharing demo. Files are encrypted with AES-256-GCM
right in the browser (Web Crypto API) before anything is stored — the
"server" (currently just React state, no backend) only ever sees ciphertext.

## Run it locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Project structure — one file per piece

```
src/
  theme.js                    Colors + fonts. Change the palette here only.

  lib/
    fileCrypto.js              The actual AES-256-GCM encrypt/decrypt logic.
    identityCrypto.js          The RSA-OAEP public-key sharing logic.

  components/
    Brand.jsx                  Logo + wordmark shown in every nav bar.
    ThemeToggle.jsx             The light/dark switch.
    VaultDial.jsx               The decorative hero illustration.

  pages/
    LandingPage.jsx             Screen 1: hero, "how it works", "why it matters".
    AuthPage.jsx                 Screen 2: login/signup (currently mocked).
    Dashboard.jsx                Screen 3: upload, encrypt, share, download.

  App.jsx                      Only decides which page is showing. No UI of
                                its own — read this last, if at all.
  main.jsx                     Vite/React entry point (rarely needs editing).
  index.css                    Tailwind directives.
```

Every file above has a comment block at the top explaining what it does —
open just the one you want to understand, you don't need to read the rest.

## Where to customize

- **Colors** — `src/theme.js`. Every color in the whole app comes from
  the `LIGHT` and `DARK` objects there.
- **Copy/wording** — `src/pages/LandingPage.jsx` has the hero headline and
  the `steps` / `rows` arrays for the two sections below it.
- **Encryption logic** — `src/lib/fileCrypto.js` (locking/unlocking a file)
  and `src/lib/identityCrypto.js` (sharing a file's key with someone else).
- **Auth** — `src/pages/AuthPage.jsx`. `onAuth` currently accepts any
  non-empty email/password; wire it to a real backend call when you add one.

## What's real vs. mocked right now

**Real, working:**
- AES-256-GCM encryption/decryption of files, in-browser
- RSA-OAEP key generation and key-wrapping for sharing

**Mocked (frontend-only, no backend yet):**
- Login accepts anything — no real account check
- "Contacts" (Priya, Alex) are fake, generated in this browser tab
- "Open as [contact]" only works because all key pairs are kept in the
  same tab for demo purposes — in reality a private key should only ever
  exist on its owner's device
- Nothing is saved — refreshing the page clears everything

## What's next (not built — no backend included here)

1. Real accounts + login, backed by a database
2. Persisting encrypted files and share records server-side
3. Removing the "open as" demo cheat once real multi-user auth exists
