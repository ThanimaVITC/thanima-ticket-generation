import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import UserPoolEntry from '@/lib/db/models/userPoolEntry';
import { getAuthUser, requireEventAccess } from '@/lib/auth/middleware';
import { normalizeNfcId } from '@/lib/user-pool';

// GET /api/events/[eventId]/user-pool/lookup?nfcId=...
// The "bring up the details before removing" step: resolve an ID card to the
// active pool stay it belongs to.
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { eventId } = await params;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
        }

        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        let normalizedNfcId: string;
        try {
            normalizedNfcId = normalizeNfcId(req.nextUrl.searchParams.get('nfcId'));
        } catch (err) {
            return NextResponse.json(
                { error: err instanceof Error ? err.message : 'Invalid card ID' },
                { status: 400 }
            );
        }

        await connectDB();

        const event = await Event.findById(eventId).select('_id userPoolEnabled').lean();
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }
        if (!event.userPoolEnabled) {
            return NextResponse.json(
                { error: 'User Pool is not enabled for this event' },
                { status: 400 }
            );
        }

        const entry = await UserPoolEntry.findOne({
            eventId: new mongoose.Types.ObjectId(eventId),
            nfcId: normalizedNfcId,
            exitedAt: null,
        }).lean();

        if (!entry) {
            return NextResponse.json(
                { found: false, error: 'This ID card is not in the pool' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            found: true,
            entry: {
                _id: entry._id,
                name: entry.name,
                regNo: entry.regNo,
                email: entry.email,
                phone: entry.phone,
                nfcId: entry.nfcId,
                enteredAt: entry.enteredAt,
                durationMs: Date.now() - new Date(entry.enteredAt).getTime(),
            },
        });
    } catch (error) {
        console.error('User pool lookup error:', error);
        return NextResponse.json(
            { error: 'Failed to look up the ID card' },
            { status: 500 }
        );
    }
}
