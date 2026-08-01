import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import UserPoolEntry from '@/lib/db/models/userPoolEntry';
import { getAuthUser, requireEventAccess } from '@/lib/auth/middleware';
import { normalizeNfcId } from '@/lib/user-pool';

// POST /api/events/[eventId]/user-pool/add
// Body: { encryptedData, nfcId }
//   encryptedData - the ticket QR hash (same naming as /api/attendance/verify-qr)
//   nfcId         - the ID card's NFC tag UID, read by the mobile app
export async function POST(
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

        const body = await req.json();
        const { encryptedData, nfcId } = body;

        if (!encryptedData || typeof encryptedData !== 'string') {
            return NextResponse.json(
                { error: 'encryptedData (ticket QR) is required' },
                { status: 400 }
            );
        }

        let normalizedNfcId: string;
        try {
            normalizedNfcId = normalizeNfcId(nfcId);
        } catch (err) {
            return NextResponse.json(
                { error: err instanceof Error ? err.message : 'Invalid card ID' },
                { status: 400 }
            );
        }

        await connectDB();

        const event = await Event.findById(eventId).select('_id title userPoolEnabled').lean();
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
            return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 });
        }
        if (registration.eventId.toString() !== eventId) {
            return NextResponse.json(
                { error: 'This ticket is for a different event', wrongEvent: true },
                { status: 400 }
            );
        }

        const eventObjectId = new mongoose.Types.ObjectId(eventId);

        // Already in the pool?
        const existing = await UserPoolEntry.findOne({
            eventId: eventObjectId,
            email: registration.email,
            exitedAt: null,
        }).lean();

        if (existing) {
            return NextResponse.json(
                {
                    error: 'This user is already in the pool',
                    alreadyInPool: true,
                    entry: {
                        _id: existing._id,
                        name: existing.name,
                        regNo: existing.regNo,
                        phone: existing.phone,
                        enteredAt: existing.enteredAt,
                        durationMs: Date.now() - new Date(existing.enteredAt).getTime(),
                    },
                },
                { status: 409 }
            );
        }

        // Card already held by a different active member?
        const cardHolder = await UserPoolEntry.findOne({
            eventId: eventObjectId,
            nfcId: normalizedNfcId,
            exitedAt: null,
        }).lean();

        if (cardHolder) {
            return NextResponse.json(
                {
                    error: 'This ID card is already in the pool under another user',
                    cardInUse: true,
                    holder: { name: cardHolder.name, regNo: cardHolder.regNo },
                },
                { status: 409 }
            );
        }

        let entry;
        try {
            entry = await UserPoolEntry.create({
                eventId: eventObjectId,
                registrationId: registration._id,
                email: registration.email,
                regNo: registration.regNo,
                name: registration.name,
                phone: registration.phone,
                nfcId: normalizedNfcId,
                enteredAt: new Date(),
                exitedAt: null,
                addedBy: new mongoose.Types.ObjectId(user.userId),
            });
        } catch (err: unknown) {
            // A concurrent scan won the race. The unique partial indexes tell us
            // which conflict it was; re-read and report it the same way as above.
            if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
                const raced = await UserPoolEntry.findOne({
                    eventId: eventObjectId,
                    exitedAt: null,
                    $or: [{ email: registration.email }, { nfcId: normalizedNfcId }],
                }).lean();

                if (raced && raced.email === registration.email) {
                    return NextResponse.json(
                        {
                            error: 'This user is already in the pool',
                            alreadyInPool: true,
                            entry: {
                                _id: raced._id,
                                name: raced.name,
                                regNo: raced.regNo,
                                phone: raced.phone,
                                enteredAt: raced.enteredAt,
                                durationMs: Date.now() - new Date(raced.enteredAt).getTime(),
                            },
                        },
                        { status: 409 }
                    );
                }

                return NextResponse.json(
                    {
                        error: 'This ID card is already in the pool under another user',
                        cardInUse: true,
                        holder: raced ? { name: raced.name, regNo: raced.regNo } : null,
                    },
                    { status: 409 }
                );
            }
            throw err;
        }

        const currentCount = await UserPoolEntry.countDocuments({
            eventId: eventObjectId,
            exitedAt: null,
        });

        return NextResponse.json({
            ok: true,
            message: 'User added to the pool',
            entry: {
                _id: entry._id,
                name: entry.name,
                regNo: entry.regNo,
                email: entry.email,
                phone: entry.phone,
                nfcId: entry.nfcId,
                enteredAt: entry.enteredAt,
                durationMs: 0,
            },
            currentCount,
        });
    } catch (error) {
        console.error('User pool add error:', error);
        return NextResponse.json(
            { error: 'Failed to add user to the pool' },
            { status: 500 }
        );
    }
}
