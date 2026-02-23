import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyToken, JWTPayload } from './jwt';
import connectDB from '@/lib/db/connection';
import Account from '@/lib/db/models/account';
import { AccountRole } from '@/lib/db/models/account';

export type { JWTPayload };

/**
 * Verify JWT and check that the account still exists in DB.
 * Returns full user info with fresh role/assignedEvents from DB.
 */
export async function getAuthUser(): Promise<JWTPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
        return null;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return null;
    }

    // DB lookup to verify user still exists and get fresh role/events
    await connectDB();
    const account = await Account.findById(decoded.userId).lean();
    if (!account) {
        return null;
    }

    return {
        userId: account._id.toString(),
        email: account.email,
        role: account.role,
        assignedEvents: (account.assignedEvents || []).map((id: { toString: () => string }) => id.toString()),
    };
}

/**
 * Check if user has one of the allowed roles.
 * Returns a 403 response if not allowed, or null if allowed.
 */
export function requireRole(user: JWTPayload, ...allowedRoles: AccountRole[]): NextResponse | null {
    if (!allowedRoles.includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }
    return null;
}

/**
 * Check if user has access to the specified event.
 * Admins always have access. event_admin and app_user must have the event in assignedEvents.
 * Returns a 403 response if not allowed, or null if allowed.
 */
export function requireEventAccess(user: JWTPayload, eventId: string): NextResponse | null {
    if (user.role === 'admin') return null;
    if (user.assignedEvents?.includes(eventId)) return null;
    return NextResponse.json({ error: 'Forbidden: no access to this event' }, { status: 403 });
}

