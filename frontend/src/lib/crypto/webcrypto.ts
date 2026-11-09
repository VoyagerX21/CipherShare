/**
 * Cryptographic operations for CipherShare using the browser standard Web Crypto API.
 * Uses Hybrid Cryptography:
 * - RSA-OAEP 3072-bit for Asymmetric Key Exchange
 * - AES-256-GCM (128-bit tag, 96-bit nonce) for Authenticated Symmetric Encryption
 * - Canonical Additional Authenticated Data (AAD) binding
 * - PBKDF2-SHA-256 + AES-GCM for encrypted local private key storage
 */

export const CRYPTO_VERSION = "1.0";
export const PBKDF2_ITERATIONS = 600000;

function getCrypto(): Crypto {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is not available in this environment');
}

// Utility helpers for conversions
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return (typeof btoa !== 'undefined' ? btoa : globalThis.btoa)(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = (typeof atob !== 'undefined' ? atob : globalThis.atob)(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToArrayBuffer(hexString: string): ArrayBuffer {
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes.buffer;
}

/**
 * Computes SHA-256 hash of an ArrayBuffer or string
 */
export async function computeSHA256(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  return computeDigest(data, 'SHA-256');
}

/**
 * Computes cryptographic hash digest (SHA-256 or SHA-512)
 */
export async function computeDigest(
  data: ArrayBuffer | Uint8Array | string,
  algorithm: 'SHA-256' | 'SHA-512' = 'SHA-256'
): Promise<string> {
  const crypto = getCrypto();
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest(algorithm, buffer);
  return arrayBufferToHex(digest);
}

/**
 * Computes RFC 7638 JWK Thumbprint fingerprint for an RSA public key
 */
export async function computeJWKFingerprint(jwk: JsonWebKey): Promise<string> {
  const canonical = {
    e: jwk.e,
    kty: jwk.kty,
    n: jwk.n
  };
  const jsonStr = JSON.stringify(canonical);
  return computeSHA256(jsonStr);
}

/**
 * Generates an RSA-OAEP asymmetric key pair (configurable modulus 2048 or 3072 bits)
 */
export async function generateUserKeyPair(
  modulusLength: number = 3072,
  hash: string = 'SHA-256'
): Promise<CryptoKeyPair> {
  const crypto = getCrypto();
  return crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
      hash
    },
    true, // extractable
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/**
 * Exports public key as a JWK string
 */
export async function exportPublicKeyJWK(publicKey: CryptoKey): Promise<string> {
  const crypto = getCrypto();
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  return JSON.stringify(jwk);
}

/**
 * Imports a public key from a JWK JSON string
 */
export async function importPublicKeyJWK(jwkJson: string): Promise<CryptoKey> {
  const crypto = getCrypto();
  const jwk = JSON.parse(jwkJson);
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    true,
    ['encrypt', 'wrapKey']
  );
}

/**
 * Generates a fresh random AES-GCM symmetric key (128-bit or 256-bit)
 */
export async function generateFileAESKey(length: 128 | 256 = 256): Promise<CryptoKey> {
  const crypto = getCrypto();
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length
    },
    true, // extractable for key wrapping
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates a fresh 96-bit (12-byte) random nonce for AES-GCM
 */
export function generateAESNonce(): Uint8Array {
  const crypto = getCrypto();
  const nonce = new Uint8Array(12);
  crypto.getRandomValues(nonce);
  return nonce;
}

/**
 * Creates canonical Additional Authenticated Data (AAD) for AES-256-GCM
 */
export function createCanonicalAAD(fileId: string, senderId: string, cryptoVersion: string = CRYPTO_VERSION): Uint8Array {
  const canonicalObj = {
    fileId,
    senderId,
    version: cryptoVersion
  };
  // Explicitly canonical: sorted keys, no whitespace
  const jsonStr = JSON.stringify(canonicalObj);
  return new TextEncoder().encode(jsonStr);
}

/**
 * Encrypts file bytes using AES-256-GCM with AAD
 */
export async function encryptFilePayload(
  plaintextBuffer: ArrayBuffer,
  aesKey: CryptoKey,
  nonce: Uint8Array,
  aad: Uint8Array
): Promise<ArrayBuffer> {
  const crypto = getCrypto();
  return crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: aad,
      tagLength: 128
    },
    aesKey,
    plaintextBuffer
  );
}

/**
 * Decrypts file bytes using AES-256-GCM with AAD
 * Throws OperationError if ciphertext or AAD is modified/tampered.
 */
export async function decryptFilePayload(
  ciphertextBuffer: ArrayBuffer,
  aesKey: CryptoKey,
  nonce: Uint8Array,
  aad: Uint8Array
): Promise<ArrayBuffer> {
  const crypto = getCrypto();
  return crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: aad,
      tagLength: 128
    },
    aesKey,
    ciphertextBuffer
  );
}

/**
 * Wraps (encrypts) the AES file key with a recipient's RSA-OAEP public key
 */
export async function wrapAESKeyForRecipient(
  aesKey: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<string> {
  const crypto = getCrypto();
  const wrappedBuffer = await crypto.subtle.wrapKey(
    'raw',
    aesKey,
    recipientPublicKey,
    {
      name: 'RSA-OAEP'
    }
  );
  return arrayBufferToBase64(wrappedBuffer);
}

/**
 * Unwraps (decrypts) the AES file key using the recipient's RSA-OAEP private key
 */
export async function unwrapAESKeyWithPrivateKey(
  wrappedKeyBase64: string,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  const crypto = getCrypto();
  const wrappedBuffer = base64ToArrayBuffer(wrappedKeyBase64);
  return crypto.subtle.unwrapKey(
    'raw',
    wrappedBuffer,
    privateKey,
    {
      name: 'RSA-OAEP'
    },
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derives a key-encryption key from a user passphrase using PBKDF2-SHA-256
 */
async function derivePassphraseKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const crypto = getCrypto();
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an exported PKCS#8 private key using a user passphrase
 */
export async function encryptPrivateKeyWithPassphrase(
  privateKey: CryptoKey,
  passphrase: string,
  iterations: number = PBKDF2_ITERATIONS
): Promise<{ encryptedBase64: string; saltBase64: string; ivBase64: string; iterations: number }> {
  const crypto = getCrypto();
  // Export private key to PKCS#8 format
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);

  // Generate random salt and iv
  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(salt);
  crypto.getRandomValues(iv);

  const derivedKey = await derivePassphraseKey(passphrase, salt, iterations);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128
    },
    derivedKey,
    pkcs8
  );

  return {
    encryptedBase64: arrayBufferToBase64(encryptedBuffer),
    saltBase64: arrayBufferToBase64(salt),
    ivBase64: arrayBufferToBase64(iv),
    iterations
  };
}

/**
 * Decrypts an encrypted PKCS#8 blob using a passphrase and imports the RSA-OAEP private key
 */
export async function decryptPrivateKeyWithPassphrase(
  encryptedBase64: string,
  saltBase64: string,
  ivBase64: string,
  iterations: number,
  passphrase: string
): Promise<CryptoKey> {
  const crypto = getCrypto();
  const encryptedBuffer = base64ToArrayBuffer(encryptedBase64);
  const salt = new Uint8Array(base64ToArrayBuffer(saltBase64));
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));

  const derivedKey = await derivePassphraseKey(passphrase, salt, iterations);

  // Will throw an OperationError if passphrase / authentication tag fails
  const pkcs8Buffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128
    },
    derivedKey,
    encryptedBuffer
  );

  return crypto.subtle.importKey(
    'pkcs8',
    pkcs8Buffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    true,
    ['decrypt', 'unwrapKey']
  );
}
