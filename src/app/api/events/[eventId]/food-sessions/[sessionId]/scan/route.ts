import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import FoodSession from '@/lib/db/models/foodSession';
import FoodAssignment from '@/lib/db/models/foodAssignment';
import { getAuthUser, requireEventAccess } from '@/lib/auth/middleware';
import { serializeFoodSession } from '@/lib/food-session-stats';
import { describeFoodColor } from '@/lib/food-colors';
import { resolveCounterScan } from '@/lib/food-counter';

// POST /api/events/[eventId]/food-sessions/[sessionId]/scan
// The food counter. Capacity was already settled when the attendee was given a colour at
// the door, so this reserves nothing — it checks the colour matches and stamps `servedAt`.
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
        }).lean();
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

        const attendee = {
            name: registration.name,
            regNo: registration.regNo,
            email: registration.email,
        };

        const assignment = await FoodAssignment.findOne({
            eventId: new mongoose.Types.ObjectId(eventId),
            email: registration.email,
        });

        const outcome = resolveCounterScan(
            assignment && {
                foodSessionId: assignment.foodSessionId.toString(),
                servedAt: assignment.servedAt,
            },
            sessionId
        );

        if (outcome.kind === 'noAssignment') {
            return NextResponse.json(
                {
                    error: 'No food slot assigned',
                    noAssignment: true,
                    attendee,
                },
                { status: 409 }
            );
        }

        if (outcome.kind === 'wrongSession') {
            const assigned = await FoodSession.findById(outcome.assignedSessionId).select('color').lean();
            return NextResponse.json(
                {
                    error: 'Attendee belongs to a different food session',
                    wrongSession: true,
                    attendee,
                    assigned: assigned
                        ? { sessionId: assigned._id, color: assigned.color, ...describeFoodColor(assigned.color) }
                        : null,
                },
                { status: 409 }
            );
        }

        if (outcome.kind === 'alreadyServed') {
            return NextResponse.json(
                {
                    error: 'Attendee has already been served',
                    alreadyServed: true,
                    servedAt: assignment!.servedAt,
                    attendee,
                },
                { status: 409 }
            );
        }

        // Stamp the serve. Conditional on servedAt still being null so two counters
        // scanning the same person at once cannot both report success.
        const served = await FoodAssignment.findOneAndUpdate(
            { _id: assignment!._id, servedAt: null },
            { $set: { servedAt: new Date(), servedBy: new mongoose.Types.ObjectId(user.userId) } },
            { new: true }
        );

        if (!served) {
            return NextResponse.json(
                {
                    error: 'Attendee has already been served',
                    alreadyServed: true,
                    servedAt: assignment!.servedAt,
                    attendee,
                },
                { status: 409 }
            );
        }

        const servedCount = await FoodAssignment.countDocuments({
            foodSessionId: new mongoose.Types.ObjectId(sessionId),
            servedAt: { $ne: null },
        });

        return NextResponse.json({
            ok: true,
            renderFoodScreen: true,
            message: 'Attendee served',
            attendee,
            servedAt: served.servedAt,
            session: serializeFoodSession(session, servedCount),
        });
    } catch (error) {
        console.error('Food session scan error:', error);
        return NextResponse.json(
            { error: 'Failed to process food session scan' },
            { status: 500 }
        );
    }
}
