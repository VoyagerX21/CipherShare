import { openDB, IDBPDatabase } from 'idb';
import { LocalEncryptedKeyBlob } from '../../types';
import { decryptPrivateKeyWithPassphrase } from './webcrypto';

const DB_NAME = 'CipherShareKeyVault';
const DB_VERSION = 1;
const STORE_NAME = 'user_private_keys';

let activeUnlockedKey: { userId: string; key: CryptoKey } | null = null;

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
    },
  });
}

/**
 * Checks if a local encrypted private key backup exists for the given user ID.
 */
export async function hasLocalKeyBlob(userId: string): Promise<boolean> {
  try {
    const db = await getDB();
    const item = await db.get(STORE_NAME, userId);
    return !!item;
  } catch (err) {
    console.error('Failed to query local key store', err);
    return false;
  }
}

/**
 * Saves an encrypted private key blob into IndexedDB.
 * Never stores plaintext private keys!
 */
export async function saveLocalKeyBlob(blob: LocalEncryptedKeyBlob): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, blob);
}

/**
 * Retrieves the encrypted private key blob from IndexedDB.
 */
export async function getLocalKeyBlob(userId: string): Promise<LocalEncryptedKeyBlob | null> {
  const db = await getDB();
  const item = await db.get(STORE_NAME, userId);
  return (item as LocalEncryptedKeyBlob) || null;
}

/**
 * Unlocks the local private key using the user's passphrase.
 * Caches in memory for the active browser session only.
 */
export async function unlockPrivateKey(userId: string, passphrase: string): Promise<CryptoKey> {
  const blob = await getLocalKeyBlob(userId);
  if (!blob) {
    throw new Error('No local private key backup found on this device/browser.');
  }

  const privateKey = await decryptPrivateKeyWithPassphrase(
    blob.encryptedPkcs8Base64,
    blob.saltBase64,
    blob.ivBase64,
    blob.iterations,
    passphrase
  );

  activeUnlockedKey = { userId, key: privateKey };
  return privateKey;
}

/**
 * Returns currently unlocked private key in memory, or null if locked.
 */
export function getUnlockedPrivateKey(userId: string): CryptoKey | null {
  if (activeUnlockedKey && activeUnlockedKey.userId === userId) {
    return activeUnlockedKey.key;
  }
  return null;
}

/**
 * Locks the private key and clears in-memory decrypted key material.
 */
export function lockPrivateKey(): void {
  activeUnlockedKey = null;
}

/**
 * Removes local private key backup (e.g. for testing or key reset).
 */
export async function deleteLocalKeyBlob(userId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, userId);
  if (activeUnlockedKey && activeUnlockedKey.userId === userId) {
    activeUnlockedKey = null;
  }
}

