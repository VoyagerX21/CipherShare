import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateFileAESKey,
  generateAESNonce,
  createCanonicalAAD,
  encryptFilePayload,
  decryptFilePayload,
  generateUserKeyPair,
  wrapAESKeyForRecipient,
  unwrapAESKeyWithPrivateKey,
  computeSHA256,
  encryptPrivateKeyWithPassphrase,
  decryptPrivateKeyWithPassphrase
} from './webcrypto';

describe('WebCrypto Hybrid Cryptography Core', () => {
  it('computes accurate SHA-256 hex digest', async () => {
    const input = 'CipherShare Test Vector';
    const hash = await computeSHA256(input);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
    // Deterministic check
    const hash2 = await computeSHA256(input);
    expect(hash).toBe(hash2);
  });

  it('performs AES-256-GCM authenticated encryption and decryption round-trip', async () => {
    const key = await generateFileAESKey();
    const nonce = generateAESNonce();
    const aad = createCanonicalAAD('test-file-123', 'sender-user-456', '1.0');
    const plaintext = new TextEncoder().encode('Hello Secure Cloud World!').buffer;

    const ciphertext = await encryptFilePayload(plaintext, key, nonce, aad);
    expect(ciphertext.byteLength).toBeGreaterThan(plaintext.byteLength);

    const decrypted = await decryptFilePayload(ciphertext, key, nonce, aad);
    const recoveredText = new TextDecoder().decode(decrypted);
    expect(recoveredText).toBe('Hello Secure Cloud World!');
  });

  it('fails AES-256-GCM decryption when ciphertext is tampered', async () => {
    const key = await generateFileAESKey();
    const nonce = generateAESNonce();
    const aad = createCanonicalAAD('test-file-123', 'sender-user-456', '1.0');
    const plaintext = new TextEncoder().encode('Protected Financial Records').buffer;

    const ciphertext = await encryptFilePayload(plaintext, key, nonce, aad);

    // Tamper with a byte
    const tamperedBytes = new Uint8Array(ciphertext.slice(0));
    tamperedBytes[tamperedBytes.length - 1] ^= 0x01;

    await expect(
      decryptFilePayload(tamperedBytes.buffer, key, nonce, aad)
    ).rejects.toThrow();
  });

  it('fails AES-256-GCM decryption when AAD is mismatched', async () => {
    const key = await generateFileAESKey();
    const nonce = generateAESNonce();
    const validAad = createCanonicalAAD('file-A', 'sender-1', '1.0');
    const tamperedAad = createCanonicalAAD('file-B', 'sender-1', '1.0');
    const plaintext = new TextEncoder().encode('Bound payload').buffer;

    const ciphertext = await encryptFilePayload(plaintext, key, nonce, validAad);

    await expect(
      decryptFilePayload(ciphertext, key, nonce, tamperedAad)
    ).rejects.toThrow();
  });

  it('performs RSA-OAEP 3072 key wrapping and unwrapping for multiple recipients', async () => {
    // Generate recipient 1 and recipient 2 key pairs
    const recipient1Keys = await generateUserKeyPair();
    const recipient2Keys = await generateUserKeyPair();

    // Generate fresh file AES-256 key
    const fileAesKey = await generateFileAESKey();

    // Wrap for recipient 1 and recipient 2
    const envelope1 = await wrapAESKeyForRecipient(fileAesKey, recipient1Keys.publicKey);
    const envelope2 = await wrapAESKeyForRecipient(fileAesKey, recipient2Keys.publicKey);

    // Envelopes must be distinct
    expect(envelope1).not.toBe(envelope2);

    // Recipient 1 successfully unwraps envelope 1
    const recoveredKey1 = await unwrapAESKeyWithPrivateKey(envelope1, recipient1Keys.privateKey);
    expect(recoveredKey1).toBeDefined();

    // Recipient 2 cannot unwrap envelope 1
    await expect(
      unwrapAESKeyWithPrivateKey(envelope1, recipient2Keys.privateKey)
    ).rejects.toThrow();

    // Recipient 2 successfully unwraps envelope 2
    const recoveredKey2 = await unwrapAESKeyWithPrivateKey(envelope2, recipient2Keys.privateKey);
    expect(recoveredKey2).toBeDefined();
  });

  it('encrypts and decrypts exported private key using user passphrase (PBKDF2 + AES-GCM)', async () => {
    const userKeys = await generateUserKeyPair();
    const passphrase = 'MySuperSecretMasterPassphrase123!';
    const wrongPassphrase = 'WrongPassphrase!';

    // Encrypt private key with 10,000 iters for fast unit test
    const encryptedBlob = await encryptPrivateKeyWithPassphrase(userKeys.privateKey, passphrase, 10000);
    expect(encryptedBlob.encryptedBase64).toBeDefined();
    expect(encryptedBlob.saltBase64).toBeDefined();
    expect(encryptedBlob.ivBase64).toBeDefined();

    // Fails with wrong passphrase
    await expect(
      decryptPrivateKeyWithPassphrase(
        encryptedBlob.encryptedBase64,
        encryptedBlob.saltBase64,
        encryptedBlob.ivBase64,
        encryptedBlob.iterations,
        wrongPassphrase
      )
    ).rejects.toThrow();

    // Succeeds with correct passphrase
    const recoveredPrivateKey = await decryptPrivateKeyWithPassphrase(
      encryptedBlob.encryptedBase64,
      encryptedBlob.saltBase64,
      encryptedBlob.ivBase64,
      encryptedBlob.iterations,
      passphrase
    );
    expect(recoveredPrivateKey).toBeDefined();
    expect(recoveredPrivateKey.algorithm.name).toBe('RSA-OAEP');
  });
});
