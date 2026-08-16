import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import UserPoolEntry from '@/lib/db/models/userPoolEntry';
import { getAuthUser, requireEventAccess } from '@/lib/auth/middleware';

// GET /api/events/[eventId]/user-pool/lookup?encryptedData=...
// The "bring up the details before removing" step: resolve a ticket QR to the
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

        const encryptedData = req.nextUrl.searchParams.get('encryptedData');
        if (!encryptedData) {
            return NextResponse.json(
                { error: 'encryptedData (ticket QR) is required' },
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

        // Resolve the attendee from the QR hash (exact-match lookup, like verify-qr).
        const registration = await EventRegistration.findOne({ qrPayload: encryptedData });
        if (!registration) {
            return NextResponse.json(
                { found: false, error: 'Invalid QR code' },
                { status: 404 }
            );
        }
        if (registration.eventId.toString() !== eventId) {
            return NextResponse.json(
                { found: false, error: 'This ticket is for a different event', wrongEvent: true },
                { status: 400 }
            );
        }

        const entry = await UserPoolEntry.findOne({
            eventId: new mongoose.Types.ObjectId(eventId),
            email: registration.email,
            exitedAt: null,
        }).lean();

        if (!entry) {
            // Name the person anyway. "Ravi P is not in the pool" tells the door far more
            // than a bare rejection does, and it confirms the right ticket was scanned.
            return NextResponse.json(
                {
                    found: false,
                    error: 'This user is not in the pool',
                    attendee: {
                        name: registration.name,
                        regNo: registration.regNo,
                        email: registration.email,
                        phone: registration.phone,
                    },
                },
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
                enteredAt: entry.enteredAt,
                durationMs: Date.now() - new Date(entry.enteredAt).getTime(),
            },
        });
    } catch (error) {
        console.error('User pool lookup error:', error);
        return NextResponse.json(
            { error: 'Failed to look up the ticket' },
            { status: 500 }
        );
    }
}
