// Helpers shared by every User Pool route.
//
// normalizeNfcId is the important one: the add flow and the removal lookup MUST
// agree byte-for-byte on how a card UID is spelled, or removal silently finds
// nothing at the door. One function, called from both.

/**
 * Normalize an NFC tag UID to canonical storage form: uppercase hex, no
 * separators. Accepts "04:a2:3f", "04-A2-3F", "04 a2 3f", "04a23f".
 * Throws on anything that isn't an even-length hex string.
 */
export function normalizeNfcId(raw: unknown): string {
    if (typeof raw !== 'string') {
        throw new Error('Card ID is required');
    }

    const cleaned = raw.replace(/[\s:.-]/g, '').toUpperCase();

    if (cleaned.length === 0) {
        throw new Error('Card ID is required');
    }
    if (!/^[0-9A-F]+$/.test(cleaned)) {
        throw new Error('Card ID must be hexadecimal');
    }
    // NFC UIDs are whole bytes (4, 7 or 10 of them in practice).
    if (cleaned.length % 2 !== 0) {
        throw new Error('Card ID must have an even number of hex digits');
    }

    return cleaned;
}

/**
 * Human-readable stay length: "2h 14m", "43m", "58s".
 */
export function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return '—';

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}
