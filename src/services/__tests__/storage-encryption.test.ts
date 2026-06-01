/**
 * Storage Encryption Unit Tests
 *
 * Tests for AES-256-GCM encryption of sensitive data
 */

import { encryptData, decryptData, secureGet } from '../src/services/storage-encryption';

describe('Storage Encryption (AES-256-GCM)', () => {
  describe('Basic Encryption/Decryption', () => {
    it('should encrypt and decrypt plaintext', async () => {
      const plaintext = 'This is a secret journal entry';
      const encrypted = await encryptData(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');

      const decrypted = await decryptData(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const plaintext = 'Same message twice';
      const encrypted1 = await encryptData(plaintext);
      const encrypted2 = await encryptData(plaintext);

      // Different IVs should produce different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty strings', async () => {
      const plaintext = '';
      const encrypted = await encryptData(plaintext);
      const decrypted = await decryptData(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', async () => {
      const plaintext = '你好世界 🌍 مرحبا بالعالم';
      const encrypted = await encryptData(plaintext);
      const decrypted = await decryptData(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle very long text', async () => {
      const plaintext = 'a'.repeat(100000);
      const encrypted = await encryptData(plaintext);
      const decrypted = await decryptData(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(decrypted.length).toBe(100000);
    });
  });

  describe('Encryption Key Management', () => {
    it('should use consistent key for encryption/decryption', async () => {
      const plaintext = 'Test message';
      const encrypted1 = await encryptData(plaintext);
      const decrypted1 = await decryptData(encrypted1);

      const encrypted2 = await encryptData(plaintext);
      const decrypted2 = await decryptData(encrypted2);

      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
      // Keys are consistent across calls
    });
  });

  describe('Error Handling', () => {
    it('should throw on invalid ciphertext', async () => {
      const invalidCiphertext = 'not-valid-base64!!!';

      await expect(decryptData(invalidCiphertext)).rejects.toThrow();
    });

    it('should throw on corrupted ciphertext', async () => {
      const plaintext = 'Valid message';
      const encrypted = await encryptData(plaintext);

      // Corrupt the ciphertext (change one character)
      const corrupted = encrypted.slice(0, -5) + 'XXXXX';

      await expect(decryptData(corrupted)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should encrypt quickly', async () => {
      const plaintext = 'Short message';
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        await encryptData(plaintext);
      }

      const duration = Date.now() - start;
      // 100 encryptions should take < 5000ms
      expect(duration).toBeLessThan(5000);
    });

    it('should decrypt quickly', async () => {
      const plaintext = 'Short message';
      const encrypted = await encryptData(plaintext);

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        await decryptData(encrypted);
      }

      const duration = Date.now() - start;
      // 100 decryptions should take < 5000ms
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Data Integrity', () => {
    it('should detect tampering with IV', async () => {
      const plaintext = 'Important data';
      const encrypted = await encryptData(plaintext);

      // Tamper with first character (part of IV)
      const tampered = String.fromCharCode(
        encrypted.charCodeAt(0) ^ 1
      ) + encrypted.slice(1);

      await expect(decryptData(tampered)).rejects.toThrow();
    });

    it('should detect tampering with ciphertext', async () => {
      const plaintext = 'Important data';
      const encrypted = await encryptData(plaintext);

      // Tamper with last character (part of ciphertext)
      const tampered = encrypted.slice(0, -1) + String.fromCharCode(
        encrypted.charCodeAt(encrypted.length - 1) ^ 1
      );

      await expect(decryptData(tampered)).rejects.toThrow();
    });
  });
});
