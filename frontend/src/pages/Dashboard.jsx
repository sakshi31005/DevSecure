import React, { useState, useRef, useEffect } from "react";
import {
  Lock,
  UploadCloud,
  Download,
  Trash2,
  Eye,
  EyeOff,
  FileText,
  LogOut,
  UserPlus,
  X,
  Users,
  Loader,
  Share2,
} from "lucide-react";
import { serif, sans, mono } from "../theme";
import Brand from "../components/Brand";
import ThemeToggle from "../components/ThemeToggle";
import { encryptFile, decryptFile, bufferToBase64, formatBytes } from "../lib/fileCrypto";
import {
  wrapKeyForRecipient,
  unwrapKeyWithPrivateKey,
  importPublicKeyFromJwk,
} from "../lib/identityCrypto";
import * as api from "../lib/api";

/**
 * pages/Dashboard.jsx
 * ---------------------------------------------------------
 * WHAT THIS IS:
 * The main workspace after login. Now fully wired to the backend.
 *
 * PROPS:
 *   t, mode, onToggleTheme — standard theme props
 *   user          — logged-in user's email
 *   userKeyPair   — { publicKey, privateKey } RSA CryptoKeys
 *                   loaded from the user's persistent browser identity
 *   onLogout      — clears JWT + returns to landing page
 *
 * KEY FLOWS:
 *    UPLOAD: Encrypt the file in the browser with AES-256-GCM.
 *         The AES key is wrapped with the owner's RSA public key
 *         before the encrypted data is stored on the backend.
 *
 * DOWNLOAD (own file): Fetch the encrypted file from the backend.
 *         The AES key is recovered using the owner's RSA private key,
 *         then the file is decrypted locally and downloaded.
 *         This also works after a page refresh when the persistent
 *         identity key is available in the browser.
 *
 *   SHARE:   GET /api/users/search?email= (recipient's public key) →
 *            wrap this file's AES key with recipient's public key →
 *            POST /api/files/:id/share (wrapped key) → stored in DB.
 *
 *   DOWNLOAD (received file): GET /api/files/:id (ciphertext+iv+wrappedKey) →
 *            unwrap key with own private key → decrypt → save.
 *
 *   REVOKE:  DELETE /api/files/:id/shares/:recipientId →
 *            removes wrapped key from DB, blocking future decryption.
 * ---------------------------------------------------------
 */
export default function Dashboard({ t, mode, onToggleTheme, user, userKeyPair, onLogout }) {
  // --- State ---
  const [files, setFiles] = useState([]);   // files I own
  const [sharedFiles, setSharedFiles] = useState([]);   // files others shared with me
  const [listLoading, setListLoading] = useState(true); // initial load spinner
  const [busy, setBusy] = useState(false); // upload in progress
  const [previewId, setPreviewId] = useState(null);
  const [sharePanelId, setSharePanelId] = useState(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const inputRef = useRef(null);

  // --- Load files from backend on mount ---
  useEffect(() => {
    (async () => {
      try {
        const { owned, shared } = await api.listFiles();
        setFiles(
          owned.map((f) => ({
            id: f.id,
            name: f.filename,
            size: f.size,
            type: f.mimeType,
            rawKey: null,      // key is never sent to the backend —
            ciphertext: null,  // these are only populated for files
            iv: null,          // uploaded in the current session.
            sharedWith: [],
            fromBackend: true,
          }))
        );
        setSharedFiles(shared);
      } catch (err) {
        flashMsg("Could not load files: " + err.message, true);
      } finally {
        setListLoading(false);
      }
    })();
  }, []);

  // --- Toast helpers ---
  function flashMsg(msg, isError = false) {
    setStatusIsError(isError);
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), isError ? 5000 : 3500);
  }

  // ================================================================
  // UPLOAD + ENCRYPT
  // Encrypt in the browser → upload hex blob to backend →
  // keep rawKey + ciphertext in local state for this session.
  // ================================================================
  async function handleFiles(fileList) {
    setBusy(true);

    for (const file of Array.from(fileList)) {
      try {
        // 1. Encrypt the actual file with a new AES-256 key
        const { ciphertext, iv, rawKey } = await encryptFile(file);

        // 2. Wrap the AES key with the OWNER'S RSA public key
        // Only the matching private key can unwrap it later.
        if (!userKeyPair?.publicKey) {
          throw new Error("Your encryption key is not available. Please log in again.");
        }

        const wrappedKey = await wrapKeyForRecipient(
          rawKey,
          userKeyPair.publicKey
        );

        // 3. Upload encrypted file + IV + wrapped AES key
        const saved = await api.uploadFile({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          ciphertext,
          iv,
          wrappedKey,
        });

        // 4. Keep rawKey in memory for the current session too
        setFiles((prev) => [
          {
            id: saved.file.id,
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
            rawKey,
            ciphertext,
            iv,
            sharedWith: [],
            fromBackend: false,
          },
          ...prev,
        ]);

        flashMsg(`${file.name} encrypted and uploaded securely.`);
      } catch (err) {
        flashMsg(`Upload failed: ${err.message}`, true);
      }
    }

    setBusy(false);
  }

  // ================================================================
  // SHARE PANEL — open and load current recipients from backend
  // ================================================================
  async function openSharePanel(fileId) {
    if (sharePanelId === fileId) {
      setSharePanelId(null);
      setShareEmail("");
      return;
    }
    setSharePanelId(fileId);
    setShareEmail("");
    // Refresh the list of recipients from the backend each time
    try {
      const { shares } = await api.getShares(fileId);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
              ...f,
              sharedWith: shares.map((s) => ({ id: s.id, email: s.email })),
            }
            : f
        )
      );
    } catch {
      /* non-fatal — show stale local list */
    }
  }

  // ================================================================
  // SHARE
  // 1. Look up recipient's public key from backend.
  // 2. Wrap this file's AES key with their public key.
  // 3. POST the wrapped key to the backend.
  // ================================================================
  async function shareFile(fileId) {
    const file = files.find((f) => f.id === fileId);

    if (!file) {
      flashMsg("File not found.", true);
      return;
    }

    const trimmedEmail = shareEmail.trim();

    if (!trimmedEmail) return;

    if (trimmedEmail.toLowerCase() === user.toLowerCase()) {
      flashMsg("You can't share a file with yourself.", true);
      return;
    }

    setShareLoading(true);

    try {
      // 1. Use the AES key already in memory if available.
      // Otherwise, recover it using the owner's private RSA key.
      let rawKey = file.rawKey;

      if (!rawKey) {
        const data = await api.getFile(fileId);

        if (!data.wrappedKey) {
          throw new Error("No encrypted file key was found.");
        }

        if (!userKeyPair?.privateKey) {
          throw new Error(
            "Your private key is not available. Please log in again."
          );
        }

        rawKey = await unwrapKeyWithPrivateKey(
          api.hexToBuf(data.wrappedKey),
          userKeyPair.privateKey
        );

        // Save the recovered key for this browser session.
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, rawKey } : f
          )
        );
      }

      // 2. Find the recipient and get their public key.
      const recipient = await api.findUser(trimmedEmail);

      if (!recipient.publicKey) {
        throw new Error(
          "That user hasn't set up their encryption key yet."
        );
      }

      // 3. Import the recipient's public key.
      const recipientPublicKey = await importPublicKeyFromJwk(
        recipient.publicKey
      );

      // 4. Wrap the file's AES key for this specific recipient.
      const wrappedKey = await wrapKeyForRecipient(
        rawKey,
        recipientPublicKey
      );

      // 5. Save the recipient's wrapped key in the database.
      await api.shareFile(fileId, recipient.id, wrappedKey);

      // 6. Update the UI.
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
              ...f,
              sharedWith: [
                ...f.sharedWith.filter(
                  (s) => s.email !== recipient.email
                ),
                {
                  id: recipient.id,
                  email: recipient.email,
                },
              ],
            }
            : f
        )
      );

      flashMsg(
        `Key sealed for ${recipient.email} — only their private key can open it.`
      );

      setShareEmail("");
    } catch (err) {
      flashMsg(err.message || "Share failed.", true);
    } finally {
      setShareLoading(false);
    }
  }
  // ================================================================
  // REVOKE — deletes the wrapped key from the backend.
  // The recipient can no longer decrypt even if they have the blob.
  // ================================================================
  async function revokeShare(fileId, recipientId, recipientEmail) {
    try {
      await api.revokeShare(fileId, recipientId);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, sharedWith: f.sharedWith.filter((s) => s.id !== recipientId) }
            : f
        )
      );
      flashMsg(`Access revoked for ${recipientEmail}.`);
    } catch (err) {
      flashMsg(err.message || "Revoke failed.", true);
    }
  }

  // ================================================================
  // DOWNLOAD — fetch ciphertext from backend, decrypt with
  // in-memory rawKey, trigger browser save.
  // ================================================================
  // ================================================================
  // DOWNLOAD OWN FILE
  // Fetch the encrypted file + wrapped AES key from the backend.
  // If the raw AES key is not in memory, unwrap it using the
  // owner's RSA private key, then decrypt the file.
  // ================================================================
  async function handleDownload(f) {
    try {
      // 1. Fetch encrypted file data from the backend
      const data = await api.getFile(f.id);

      // 2. Use the in-memory key if available.
      // Otherwise, recover the AES key using the owner's private key.
      let rawKey = f.rawKey;

      if (!rawKey) {
        if (!data.wrappedKey) {
          throw new Error("No encrypted file key was found.");
        }

        if (!userKeyPair?.privateKey) {
          throw new Error(
            "Your private key is not available. Please log in again."
          );
        }

        // Convert the stored hex back to an ArrayBuffer,
        // then unlock the AES key with the RSA private key.
        rawKey = await unwrapKeyWithPrivateKey(
          api.hexToBuf(data.wrappedKey),
          userKeyPair.privateKey
        );

        // Keep the recovered key in memory for the rest of this session.
        setFiles((prev) =>
          prev.map((file) =>
            file.id === f.id ? { ...file, rawKey } : file
          )
        );
      }

      // 3. Decrypt the actual file using the recovered AES key
      const blob = await decryptFile(
        api.hexToBuf(data.ciphertext),
        api.hexToBuf(data.iv),
        rawKey,
        data.mimeType || f.type
      );

      // 4. Download the original file
      triggerDownload(blob, data.filename || f.name);

    } catch (err) {
      flashMsg("Decryption failed: " + err.message, true);
    }
  }
  // ================================================================
  // DOWNLOAD SHARED FILE — recipient fetches blob + wrappedKey,
  // unwraps AES key with their private key, then decrypts.
  // ================================================================
  async function handleDownloadShared(sf) {
    if (!userKeyPair?.privateKey) {
      flashMsg("No private key in memory — please log in again.", true);
      return;
    }
    try {
      const data = await api.getFile(sf.id);
      if (!data.wrappedKey) {
        flashMsg("No wrapped key found for your account.", true);
        return;
      }
      const rawKey = await unwrapKeyWithPrivateKey(
        api.hexToBuf(data.wrappedKey),
        userKeyPair.privateKey
      );
      const blob = await decryptFile(
        api.hexToBuf(data.ciphertext),
        api.hexToBuf(data.iv),
        rawKey,
        sf.mimeType
      );
      triggerDownload(blob, sf.filename);
    } catch (err) {
      flashMsg("Decryption failed: " + err.message, true);
    }
  }

  // Helper — append anchor to DOM before click (Firefox fix)
  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ================================================================
  // DELETE
  // ================================================================
  async function handleRemove(id) {
    try {
      await api.deleteFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      if (previewId === id) setPreviewId(null);
      if (sharePanelId === id) setSharePanelId(null);
    } catch (err) {
      flashMsg("Delete failed: " + err.message, true);
    }
  }

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <div style={{ background: t.bg, color: t.text, fontFamily: sans, minHeight: "100vh" }}>

      {/* --- Top bar --- */}
      <nav
        className="flex items-center justify-between px-6 py-5 md:px-12"
        style={{ borderBottom: `1px solid ${t.border}` }}
      >
        <Brand t={t} />
        <div className="flex items-center gap-4">
          <span
            className="hidden sm:inline text-sm rounded-full px-3 py-1"
            style={{ background: t.surfaceAlt, color: t.textMuted }}
          >
            {user}
          </span>
          <ThemeToggle mode={mode} onToggle={onToggleTheme} t={t} />
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color: t.textMuted }}
          >
            <LogOut size={15} /> Log out
          </button>
        </div>
      </nav>

      <main className="px-6 md:px-12 py-10 max-w-4xl mx-auto">
        <h1 style={{ fontFamily: serif, fontWeight: 600 }} className="text-2xl md:text-3xl mb-2">
          Your vault
        </h1>
        <p className="text-sm mb-8" style={{ color: t.textMuted }}>
          Files are encrypted in this browser tab before upload. Your key never leaves your device.
        </p>

        {/* --- Dropzone --- */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
          }}
          className="flex flex-col items-center justify-center text-center cursor-pointer rounded-2xl transition-colors duration-200"
          style={{ border: `1.5px dashed ${t.border}`, background: t.surfaceAlt, padding: "40px 24px" }}
        >
          {busy ? (
            <Loader size={24} color={t.accent} className="mb-3 animate-spin" />
          ) : (
            <UploadCloud size={26} color={t.accent} className="mb-3" />
          )}
          <p className="text-sm font-medium mb-1">
            {busy ? "Encrypting + uploading…" : "Drop a file here, or click to encrypt one"}
          </p>
          <p className="text-xs" style={{ color: t.textMuted }}>
            AES-256-GCM · a fresh key is generated for every file
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
          />
        </div>

        {/* --- My encrypted files --- */}
        <div className="mt-10">
          {listLoading ? (
            <div className="flex items-center gap-2 py-10 justify-center" style={{ color: t.textMuted }}>
              <Loader size={16} className="animate-spin" /> Loading your vault…
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: t.textMuted }}>
              Nothing in your vault yet — encrypt something above.
            </p>
          ) : (
            <div style={{ borderTop: `1px solid ${t.border}` }}>
              {files.map((f) => (
                <div key={f.id} style={{ borderBottom: `1px solid ${t.border}` }}>

                  {/* File row */}
                  <div className="flex items-center gap-4 py-4">
                    <div
                      className="flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{ width: 40, height: 40, background: t.accentSoft }}
                    >
                      <FileText size={17} color={f.fromBackend && !f.rawKey ? t.textMuted : t.accent} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      <div
                        className="flex items-center gap-2 text-xs flex-wrap mt-0.5"
                        style={{ color: t.textMuted }}
                      >
                        <span>{formatBytes(f.size)}</span>
                        <span
                          className="flex items-center gap-1 rounded-full px-2 py-0.5"
                          style={{ background: t.surfaceAlt }}
                        >
                          <Lock size={10} /> encrypted
                        </span>


                        {/* Show who it's shared with */}
                        {f.sharedWith.map((s) => (
                          <span
                            key={s.id}
                            className="flex items-center gap-1 rounded-full px-2 py-0.5"
                            style={{ background: t.accentSoft, color: t.accentDark }}
                          >
                            {s.email}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Ciphertext preview toggle (only for files uploaded this session) */}
                      {!f.fromBackend && (
                        <button
                          onClick={() => setPreviewId(previewId === f.id ? null : f.id)}
                          className="p-2 rounded-lg transition-colors"
                          style={{ color: t.textMuted }}
                          aria-label="Preview ciphertext"
                        >
                          {previewId === f.id ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      )}
                      {/* Share */}
                      <button
                        onClick={() => openSharePanel(f.id)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: sharePanelId === f.id ? t.accent : t.textMuted }}
                        aria-label="Share this file"
                        title={f.fromBackend && !f.rawKey ? "Re-upload to enable sharing" : "Share"}
                      >
                        <UserPlus size={16} />
                      </button>
                      {/* Download */}
                      <button
                        onClick={() => handleDownload(f)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: t.accent }}
                        aria-label="Decrypt and download"

                        title="Decrypt and download"
                      >
                        <Download size={16} />
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => handleRemove(f.id)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: t.danger }}
                        aria-label="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Ciphertext preview panel */}
                  {previewId === f.id && f.ciphertext && (
                    <div
                      className="mb-4 rounded-lg px-4 py-3"
                      style={{ background: t.surfaceAlt, border: `1px solid ${t.border}` }}
                    >
                      <p className="text-xs mb-1.5" style={{ color: t.textMuted }}>
                        This is all the server ever stores — unreadable without the key:
                      </p>
                      <p
                        className="text-xs break-all"
                        style={{ fontFamily: mono, color: t.text }}
                      >
                        {bufferToBase64(f.ciphertext).slice(0, 220)}…
                      </p>
                    </div>
                  )}

                  {/* Share panel */}
                  {sharePanelId === f.id && (
                    <div
                      className="mb-4 rounded-lg px-4 py-4"
                      style={{ background: t.surfaceAlt, border: `1px solid ${t.border}` }}
                    >
                      <p className="text-xs mb-3" style={{ color: t.textMuted }}>
                        Enter a DevSecure account email. Their public key seals this file's one-time key — only their private key can unseal it.
                      </p>

                      {/* Email input + share button */}
                      <div className="flex gap-2 mb-4">
                        <input
                          type="email"
                          value={shareEmail}
                          onChange={(e) => setShareEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && shareFile(f.id)}
                          placeholder="recipient@example.com"
                          disabled={shareLoading}
                          className="flex-1 rounded-lg px-3 py-2 text-xs focus:outline-none"
                          style={{
                            background: t.surface,
                            border: `1px solid ${t.border}`,
                            color: t.text,
                          }}
                        />
                        <button
                          onClick={() => shareFile(f.id)}
                          disabled={shareLoading || !shareEmail.trim()}
                          className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 transition-colors"
                          style={{
                            background: t.accent,
                            color: t.surface,
                            opacity: shareLoading || !shareEmail.trim() ? 0.6 : 1,
                          }}
                        >
                          {shareLoading ? (
                            <Loader size={12} className="animate-spin" />
                          ) : (
                            <Share2 size={12} />
                          )}
                          Share
                        </button>
                      </div>

                      {/* Current recipients */}
                      {f.sharedWith.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs font-medium" style={{ color: t.textMuted }}>
                            Shared with:
                          </p>
                          {f.sharedWith.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                              style={{ background: t.surface, border: `1px solid ${t.border}` }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Users size={13} color={t.accent} />
                                <p className="text-xs truncate">{s.email}</p>
                              </div>
                              <button
                                onClick={() => revokeShare(f.id, s.id, s.email)}
                                className="p-1.5 rounded-full flex-shrink-0"
                                style={{ color: t.danger }}
                                aria-label={`Revoke access for ${s.email}`}
                                title="Revoke access"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- Shared with me --- */}
        {sharedFiles.length > 0 && (
          <div className="mt-12">
            <h2
              style={{ fontFamily: serif, fontWeight: 600 }}
              className="text-xl mb-2"
            >
              Shared with you
            </h2>
            <p className="text-sm mb-6" style={{ color: t.textMuted }}>
              Files others have shared. Your private key unseals the one-time key and decrypts the file.
            </p>
            <div style={{ borderTop: `1px solid ${t.border}` }}>
              {sharedFiles.map((sf) => (
                <div
                  key={sf.id}
                  className="flex items-center gap-4 py-4"
                  style={{ borderBottom: `1px solid ${t.border}` }}
                >
                  <div
                    className="flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ width: 40, height: 40, background: t.accentSoft }}
                  >
                    <FileText size={17} color={t.accent} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{sf.filename}</p>
                    <div
                      className="flex items-center gap-2 text-xs mt-0.5 flex-wrap"
                      style={{ color: t.textMuted }}
                    >
                      <span>{formatBytes(sf.size)}</span>
                      <span
                        className="flex items-center gap-1 rounded-full px-2 py-0.5"
                        style={{ background: t.surfaceAlt }}
                      >
                        <Lock size={10} /> encrypted
                      </span>
                      <span>from {sf.ownerEmail}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadShared(sf)}
                    className="flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 flex-shrink-0 transition-colors"
                    style={{ background: t.accentSoft, color: t.accentDark }}
                    aria-label="Decrypt and download shared file"
                  >
                    <Download size={13} /> Open
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* --- Toast notification --- */}
      {statusMsg && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 text-sm rounded-full px-5 py-2.5 shadow-lg max-w-sm text-center"
          style={{
            background: statusIsError ? t.danger : t.text,
            color: statusIsError ? "#fff" : t.bg,
          }}
        >
          {statusMsg}
        </div>
      )}
    </div>
  );
}
