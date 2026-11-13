/**
 * lib/fileCrypto.js
 * ---------------------------------------------------------
 * WHAT THIS FILE IS:
 * The actual encryption logic for a single file. This is the
 * core of DevSecure — everything else in the app is UI around
 * these few functions.
 *
 * HOW IT WORKS (AES-GCM):
 * - encryptFile(file): generates a random AES-256 key, uses it
 *   to lock the file's contents, and hands back the locked
 *   data (ciphertext) plus the key and a random "IV" (a nonce
 *   required by AES-GCM so the same file never encrypts to the
 *   same output twice).
 * - decryptFile(...): reverses that — given the ciphertext, the
 *   IV, and the raw key, it unlocks the original bytes.
 *
 * This all runs via the browser's built-in Web Crypto API
 * (`crypto.subtle`) — no external library, no server involved.
 * ---------------------------------------------------------
 */

export async function encryptFile(file) {
  // 1. Make a brand-new AES-256 key, just for this one file.
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);

  // 2. AES-GCM needs a random 12-byte IV (nonce) per encryption.
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 3. Read the file's raw bytes, then encrypt them.
  const plainBuffer = await file.arrayBuffer();
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plainBuffer);

  // 4. Export the key to a plain format so we can store/wrap it later.
  const rawKey = await crypto.subtle.exportKey("raw", key);

  return { ciphertext, iv, rawKey };
}

export async function decryptFile(ciphertext, iv, rawKey, mimeType) {
  // Re-import the raw key bytes as a usable AES-GCM key...
  const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, true, [
    "decrypt",
  ]);
  // ...then use it (with the same IV that was used to encrypt) to unlock the data.
  const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new Blob([plainBuffer], { type: mimeType || "application/octet-stream" });
}

// Turns raw encrypted bytes into a readable string, purely so
// the UI can show you "this is the gibberish we actually store."
export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Small display helper — "48213" bytes -> "47.1 KB"
export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
