import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment variables.
 * The key must be exactly 32 bytes for AES-256.
 */
function getEncryptionKey(): Buffer {
    const key = process.env.QR_ENCRYPTION_KEY;
    if (!key) {
        throw new Error('QR_ENCRYPTION_KEY environment variable is not set');
    }

    // If key is not 32 bytes, hash it to get consistent 32 bytes
    if (key.length !== 32) {
        return crypto.createHash('sha256').update(key).digest();
    }

    return Buffer.from(key, 'utf-8');
}

/**
 * Encrypt QR payload data.
 * Returns a base64 encoded string containing: IV + ciphertext + authTag
 */
export function encryptQRPayload(data: object): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const jsonData = JSON.stringify(data);
    const encrypted = Buffer.concat([
        cipher.update(jsonData, 'utf-8'),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    // Combine IV + encrypted data + auth tag
    const combined = Buffer.concat([iv, encrypted, authTag]);

    return combined.toString('base64');
}

/**
 * Decrypt QR payload data.
 * Expects a base64 encoded string containing: IV + ciphertext + authTag
 * Returns the decrypted object or throws an error if decryption fails.
 */
export function decryptQRPayload<T = { eventId: string; email: string; timestamp: number }>(
    encryptedData: string
): T {
    try {
        const key = getEncryptionKey();
        const combined = Buffer.from(encryptedData, 'base64');

        // Extract IV, encrypted data, and auth tag
        const iv = combined.subarray(0, IV_LENGTH);
        const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
        const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);

        return JSON.parse(decrypted.toString('utf-8'));
    } catch (error) {
        throw new Error('Invalid or tampered QR data');
    }
}

/**
 * Validate that the QR payload is not expired.
 * Default expiry is 7 days (in milliseconds).
 */
export function isQRPayloadExpired(
    timestamp: number,
    maxAgeMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days
): boolean {
    const now = Date.now();
    return now - timestamp > maxAgeMs;
}
