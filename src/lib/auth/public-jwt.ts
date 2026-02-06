import jwt, { Secret } from 'jsonwebtoken';

const JWT_SECRET: Secret = process.env.JWT_SECRET!;

export interface PublicUserPayload {
    eventId: string;
    regNo: string;
    email: string;
    name: string;
    phone: string;
}

export function signPublicToken(payload: PublicUserPayload): string {
    // Public tokens expire in 24 hours
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyPublicToken(token: string): PublicUserPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as PublicUserPayload;
        // Check if it's a public token (has regNo field)
        if (!decoded.regNo) return null;
        return decoded;
    } catch {
        return null;
    }
}
