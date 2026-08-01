// Registration-number handling for the Unpaid list.
//
// Entries arrive either typed by staff or read off an ID card by the phone's
// OCR, so the same number can show up as "21bce1234", "21 BCE 1234" or
// "21BCE1234". Everything funnels through normalizeRegNo so the unique index
// on (eventId, regNo) actually catches duplicates.

/** VIT format: 2 digits (year) + 3-4 letters (branch) + 4 digits. */
export const REG_NO_PATTERN = /^\d{2}[A-Z]{3,4}\d{4}$/;

/**
 * Canonical form: uppercase, no spaces or separators.
 * Throws if the result isn't a valid registration number.
 */
export function normalizeRegNo(raw: unknown): string {
    if (typeof raw !== 'string') {
        throw new Error('Registration number is required');
    }

    const cleaned = raw.replace(/[\s._/-]/g, '').toUpperCase();

    if (cleaned.length === 0) {
        throw new Error('Registration number is required');
    }
    if (!REG_NO_PATTERN.test(cleaned)) {
        throw new Error('Registration number must look like 21BCE1234');
    }

    return cleaned;
}

/** Collapse runs of whitespace; reject empties. Names are free-form otherwise. */
export function normalizeName(raw: unknown): string {
    if (typeof raw !== 'string') {
        throw new Error('Name is required');
    }
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 2) {
        throw new Error('Name must be at least 2 characters');
    }
    return cleaned;
}
