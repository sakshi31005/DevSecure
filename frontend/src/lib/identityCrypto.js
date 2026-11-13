/**
 * lib/identityCrypto.js
 * ---------------------------------------------------------
 * RSA identity keys for DevSecure.
 *
 * The public key can be stored on the server.
 * The private key is stored only in this browser.
 * We store it as JWK in localStorage for persistence.
 *
 * NOTE: For this college project, localStorage is used to
 * demonstrate persistent identity keys. In a production app,
 * the private key should be encrypted with a password-derived
 * key before storage.
 * ---------------------------------------------------------
 */

// Generate a new RSA-OAEP key pair for a new user.
export async function generateIdentityKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Export public key so it can be sent to the backend.
export async function exportPublicKeyAsJwk(publicKey) {
  return crypto.subtle.exportKey("jwk", publicKey);
}

// Import a public key received from the backend.
export async function importPublicKeyFromJwk(jwkStringOrObject) {
  const jwk =
    typeof jwkStringOrObject === "string"
      ? JSON.parse(jwkStringOrObject)
      : jwkStringOrObject;

  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

// Wrap an AES file key using someone's public key.
export async function wrapKeyForRecipient(rawKeyBuffer, recipientPublicKey) {
  return crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    rawKeyBuffer
  );
}

// Unwrap an AES file key using the matching private key.
export async function unwrapKeyWithPrivateKey(
  wrappedKeyBuffer,
  recipientPrivateKey
) {
  return crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    recipientPrivateKey,
    wrappedKeyBuffer
  );
}

// ==========================================================
// PERSISTENT IDENTITY KEY HELPERS
// ==========================================================

// Create a unique localStorage name for each user's key pair.
function getStorageKey(email) {
  return `devsecure_identity_${email.toLowerCase()}`;
}

// Save the RSA key pair in this browser.
export async function saveIdentityKeyPair(email, keyPair) {
  const publicKeyJwk = await crypto.subtle.exportKey(
    "jwk",
    keyPair.publicKey
  );

  const privateKeyJwk = await crypto.subtle.exportKey(
    "jwk",
    keyPair.privateKey
  );

  localStorage.setItem(
    getStorageKey(email),
    JSON.stringify({
      publicKey: publicKeyJwk,
      privateKey: privateKeyJwk,
    })
  );
}

// Load the same RSA key pair from this browser.
export async function loadIdentityKeyPair(email) {
  const saved = localStorage.getItem(getStorageKey(email));

  if (!saved) {
    return null;
  }

  const { publicKey, privateKey } = JSON.parse(saved);

  const importedPublicKey = await crypto.subtle.importKey(
    "jwk",
    publicKey,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );

  const importedPrivateKey = await crypto.subtle.importKey(
    "jwk",
    privateKey,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"]
  );

  return {
    publicKey: importedPublicKey,
    privateKey: importedPrivateKey,
  };
}