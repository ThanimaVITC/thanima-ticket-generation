import { NextRequest, NextResponse } from 'next/server';

// In-memory store for sync tokens
// Map<token, { data: any[] | null, createdAt: number }>
const syncStore = new Map<string, { data: any[] | null; createdAt: number }>();

// Clean up expired tokens (older than 5 minutes)
function cleanupExpired() {
    const now = Date.now();
    for (const [token, entry] of syncStore.entries()) {
        if (now - entry.createdAt > 5 * 60 * 1000) {
            syncStore.delete(token);
        }
    }
}

/**
 * GET /api/registrations/extension-sync?token=xxx
 * 
 * Called by the webapp to:
 * 1. Register a new sync token (if action=register)
 * 2. Poll for data from the extension
 */
export async function GET(req: NextRequest) {
    cleanupExpired();

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const action = searchParams.get('action');

    if (!token) {
        return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Register a new sync token
    if (action === 'register') {
        syncStore.set(token, { data: null, createdAt: Date.now() });
        return NextResponse.json({ status: 'registered', token });
    }

    // Poll for data
    const entry = syncStore.get(token);
    if (!entry) {
        return NextResponse.json({ status: 'expired' });
    }

    if (entry.data) {
        // Data is ready — return it and clean up
        const data = entry.data;
        syncStore.delete(token);
        return NextResponse.json({ status: 'ready', data });
    }

    return NextResponse.json({ status: 'waiting' });
}

/**
 * POST /api/registrations/extension-sync
 * 
 * Called by the Chrome extension to push registration data.
 * Body: { token: string, registrations: Array<{ name, id, email, phone, paymentStatus, paid }> }
 */
export async function POST(req: NextRequest) {
    cleanupExpired();

    try {
        const body = await req.json();
        const { token, registrations } = body;

        if (!token || !registrations || !Array.isArray(registrations)) {
            return NextResponse.json(
                { error: 'Token and registrations array are required' },
                { status: 400 }
            );
        }

        const entry = syncStore.get(token);
        if (!entry) {
            return NextResponse.json(
                { error: 'Invalid or expired sync token. Please generate a new one from the webapp.' },
                { status: 404 }
            );
        }

        // Store the data
        entry.data = registrations;
        syncStore.set(token, entry);

        return NextResponse.json({
            success: true,
            message: `${registrations.length} registrations received`,
            count: registrations.length,
        });
    } catch (error) {
        console.error('Extension sync POST error:', error);
        return NextResponse.json(
            { error: 'Failed to process data' },
            { status: 500 }
        );
    }
}
