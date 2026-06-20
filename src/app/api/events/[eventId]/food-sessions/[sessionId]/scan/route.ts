import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import FoodSession from '@/lib/db/models/foodSession';
import FoodScan from '@/lib/db/models/foodScan';
import { getAuthUser, requireEventAccess } from '@/lib/auth/middleware';
import { computeFoodSessionStats } from '@/lib/food-session-stats';

// POST /api/events/[eventId]/food-sessions/[sessionId]/scan
// Staff scans an attendee's ticket QR to admit them to a food session.
// Body: { encryptedData } — the QR hash value (same naming as /api/attendance/verify-qr).
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ eventId: string; sessionId: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { eventId, sessionId } = await params;

        if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(sessionId)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        const body = await req.json();
        const { encryptedData } = body;

        if (!encryptedData || typeof encryptedData !== 'string') {
            return NextResponse.json(
                { error: 'encryptedData (QR hash) is required' },
                { status: 400 }
            );
        }

        await connectDB();

        // Event must exist and have food sessions enabled.
        const event = await Event.findById(eventId).select('_id title foodSessionsEnabled').lean();
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }
        if (!event.foodSessionsEnabled) {
            return NextResponse.json(
                { error: 'Food sessions are not enabled for this event' },
                { status: 400 }
            );
        }

        // Session must exist, belong to this event, and be visible.
        const session = await FoodSession.findOne({
            _id: new mongoose.Types.ObjectId(sessionId),
            eventId: new mongoose.Types.ObjectId(eventId),
        });
        if (!session) {
            return NextResponse.json({ error: 'Food session not found' }, { status: 404 });
        }
        if (!session.isVisible) {
            return NextResponse.json(
                { error: 'Session not available', sessionUnavailable: true },
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
                { error: 'This QR code is for a different event', wrongEvent: true },
                { status: 400 }
            );
        }

        const normalizedEmail = registration.email;

        // Once per event: reject if this attendee was already admitted to any session.
        const existingScan = await FoodScan.findOne({
            eventId: new mongoose.Types.ObjectId(eventId),
            email: normalizedEmail,
        }).lean();

        if (existingScan) {
            const scannedSession = await FoodSession.findById(existingScan.foodSessionId)
                .select('name')
                .lean();
            return NextResponse.json(
                {
                    error: 'Attendee already scanned for food',
                    alreadyScanned: true,
                    scannedAt: existingScan.scannedAt,
                    scannedSessionName: scannedSession?.name ?? null,
                    attendee: {
                        name: registration.name,
                        regNo: registration.regNo,
                        email: registration.email,
                    },
                },
                { status: 409 }
            );
        }

        // Atomically reserve a slot only if the session is visible and below max capacity.
        const reserved = await FoodSession.findOneAndUpdate(
            {
                _id: new mongoose.Types.ObjectId(sessionId),
                isVisible: true,
                $expr: { $lt: ['$count', '$maxLimit'] },
            },
            { $inc: { count: 1 } },
            { new: true }
        );

        if (!reserved) {
            // Either it just got hidden or it is at max capacity.
            const fresh = await FoodSession.findById(sessionId).select('count limit maxLimit isVisible').lean();
            if (fresh && !fresh.isVisible) {
                return NextResponse.json(
                    { error: 'Session not available', sessionUnavailable: true },
                    { status: 400 }
                );
            }
            return NextResponse.json(
                {
                    error: 'Session is at full capacity',
                    full: true,
                    stats: fresh
                        ? computeFoodSessionStats(fresh.count, fresh.limit, fresh.maxLimit)
                        : null,
                },
                { status: 409 }
            );
        }

        // Persist the scan. A duplicate-key error means a concurrent scan won the race
        // for this attendee — roll back the reserved slot and report alreadyScanned.
        try {
            await FoodScan.create({
                eventId: new mongoose.Types.ObjectId(eventId),
                foodSessionId: new mongoose.Types.ObjectId(sessionId),
                email: normalizedEmail,
                regNo: registration.regNo,
                name: registration.name,
                scannedBy: new mongoose.Types.ObjectId(user.userId),
                scannedAt: new Date(),
            });
        } catch (err: unknown) {
            await FoodSession.findByIdAndUpdate(sessionId, { $inc: { count: -1 } });
            if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
                const existing = await FoodScan.findOne({
                    eventId: new mongoose.Types.ObjectId(eventId),
                    email: normalizedEmail,
                }).lean();
                const scannedSession = existing
                    ? await FoodSession.findById(existing.foodSessionId).select('name').lean()
                    : null;
                return NextResponse.json(
                    {
                        error: 'Attendee already scanned for food',
                        alreadyScanned: true,
                        scannedAt: existing?.scannedAt ?? null,
                        scannedSessionName: scannedSession?.name ?? null,
                        attendee: {
                            name: registration.name,
                            regNo: registration.regNo,
                            email: registration.email,
                        },
                    },
                    { status: 409 }
                );
            }
            throw err;
        }

        const stats = computeFoodSessionStats(reserved.count, reserved.limit, reserved.maxLimit);

        return NextResponse.json({
            ok: true,
            renderFoodScreen: true,
            message: 'Attendee admitted to food session',
            attendee: {
                name: registration.name,
                regNo: registration.regNo,
                email: registration.email,
            },
            session: {
                id: reserved._id,
                name: reserved.name,
                limit: reserved.limit,
                maxLimit: reserved.maxLimit,
                count: reserved.count,
            },
            stats,
        });
    } catch (error) {
        console.error('Food session scan error:', error);
        return NextResponse.json(
            { error: 'Failed to process food session scan' },
            { status: 500 }
        );
    }
}
