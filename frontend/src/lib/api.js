/**
 * lib/api.js
 * ---------------------------------------------------------
 * WHAT THIS IS:
 * The single place where the frontend talks to the backend.
 * Every network call goes through here — no fetch() scattered
 * across components.
 *
 * HOW IT WORKS:
 * - `request()` is the base helper: adds the Authorization
 *   header automatically if a JWT is stored in localStorage.
 * - All other functions are thin wrappers that call `request()`
 *   with the right method/path/body.
 *
 * HOW TO USE IN A COMPONENT:
 *   import * as api from "../lib/api";
 *
 *   // Auth
 *   const { token, user } = await api.signup(email, password, publicKeyJwk);
 *   const { token, user } = await api.login(email, password, publicKeyJwk);
 *   api.setToken(token);      // call after login/signup
 *   api.clearToken();         // call on logout
 *
 *   // Files
 *   const file = await api.uploadFile({ filename, mimeType, size, ciphertext, iv });
 *   const { owned, shared }  = await api.listFiles();
 *   const fileData = await api.getFile(id);
 *   await api.deleteFile(id);
 *
 *   // Sharing
 *   await api.shareFile(fileId, recipientId, wrappedKeyHex);
 *   const { shares } = await api.getShares(fileId);
 *   await api.revokeShare(fileId, recipientId);
 *
 *   // Users
 *   const { id, email, publicKey } = await api.findUser(email);
 * ---------------------------------------------------------
 */

const BASE = `${import.meta.env.VITE_API_URL}/api`;
// ---------- Token storage ----------

export function setToken(token) {
  localStorage.setItem("ds_token", token);
}

export function getToken() {
  return localStorage.getItem("ds_token");
}

export function clearToken() {
  localStorage.removeItem("ds_token");
}

// ---------- Base fetch helper ----------

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    // Throw with the server's error message so components can display it
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

// ---------- Auth ----------

export async function signup(email, password, publicKeyJwk = null) {
  return request("POST", "/auth/signup", {
    name: email.split("@")[0],
    email,
    password,
    publicKey: publicKeyJwk ? JSON.stringify(publicKeyJwk) : null,
  });
}

export async function login(email, password, publicKeyJwk = null) {
  return request("POST", "/auth/login", {
    email,
    password,
    publicKey: publicKeyJwk ? JSON.stringify(publicKeyJwk) : null,
  });
}

// ---------- Files ----------

/**
 * Upload an encrypted file.
 * ciphertext and iv should be ArrayBuffers — this function
 * converts them to hex strings before sending.
 */
export async function uploadFile({
  filename,
  mimeType,
  size,
  ciphertext,
  iv,
  wrappedKey,
}) {
  return request("POST", "/files", {
    filename,
    mimeType,
    size,
    ciphertext: bufToHex(ciphertext),
    iv: bufToHex(iv),
    wrappedKey: bufToHex(wrappedKey),
  });
}

export async function listFiles() {
  return request("GET", "/files");
}

/**
 * Fetch a single file's ciphertext and IV for decryption.
 * Returns hex strings; caller must convert back with hexToBuf().
 */
export async function getFile(id) {
  return request("GET", `/files/${id}`);
}

export async function deleteFile(id) {
  return request("DELETE", `/files/${id}`);
}

// ---------- Sharing ----------

/**
 * Share a file with a recipient.
 * wrappedKey should be an ArrayBuffer (the RSA-encrypted AES key).
 */
export async function shareFile(fileId, recipientId, wrappedKey) {
  return request("POST", `/files/${fileId}/share`, {
    recipientId,
    wrappedKey: bufToHex(wrappedKey),
  });
}

export async function getShares(fileId) {
  return request("GET", `/files/${fileId}/shares`);
}

export async function revokeShare(fileId, recipientId) {
  return request("DELETE", `/files/${fileId}/shares/${recipientId}`);
}

// ---------- Users ----------

export async function findUser(email) {
  return request("GET", `/users/search?email=${encodeURIComponent(email)}`);
}

export async function savePublicKey(publicKey) {
  return request("PUT", "/users/public-key", {
    publicKey: JSON.stringify(publicKey),
  });
}

// ---------- Hex <-> Buffer helpers ----------
// Ciphertext and keys are ArrayBuffers in the browser but need
// to be strings for JSON transport. We use hex (not base64) for
// cleaner debug output in the DB.

export function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}
