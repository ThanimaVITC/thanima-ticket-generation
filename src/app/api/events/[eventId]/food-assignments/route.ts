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
import { reserveSeat, releaseSeat } from '@/lib/food-assignment';

// GET /api/events/[eventId]/food-assignments - Every assigned slot for the event.
// Backs the "Food slot" column on the dashboard's attendees table.
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

        await connectDB();

        const oid = new mongoose.Types.ObjectId(eventId);
        const [assignments, sessions] = await Promise.all([
            FoodAssignment.find({ eventId: oid }).lean(),
            FoodSession.find({ eventId: oid }).sort({ createdAt: 1 }).lean(),
        ]);

        const colorBySession = new Map(sessions.map((s) => [s._id.toString(), s.color]));

        return NextResponse.json({
            sessions: sessions.map(serializeFoodSession),
            assignments: assignments.map((a) => {
                const color = colorBySession.get(a.foodSessionId.toString()) ?? '';
                return {
                    _id: a._id,
                    email: a.email,
                    regNo: a.regNo,
                    name: a.name,
                    sessionId: a.foodSessionId,
                    color,
                    ...describeFoodColor(color),
                    assignedAt: a.assignedAt,
                    servedAt: a.servedAt ?? null,
                    emailStatus: a.emailStatus ?? 'pending',
                    emailSentAt: a.emailSentAt ?? null,
                };
            }),
        });
    } catch (error) {
        console.error('Error fetching food assignments:', error);
        return NextResponse.json({ error: 'Failed to fetch food assignments' }, { status: 500 });
    }
}

// POST /api/events/[eventId]/food-assignments - Give an attendee a food colour.
// Called from the mobile app right after attendance is marked. This is where a seat is
// consumed, so the capacity guard lives here rather than at the food counter.
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
        const { email, foodSessionId } = body;

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'email is required' }, { status: 400 });
        }
        if (!foodSessionId || !mongoose.Types.ObjectId.isValid(foodSessionId)) {
            return NextResponse.json({ error: 'A valid foodSessionId is required' }, { status: 400 });
        }

        await connectDB();

        const oid = new mongoose.Types.ObjectId(eventId);
        const normalizedEmail = email.trim().toLowerCase();

        const event = await Event.findById(eventId).select('_id foodSessionsEnabled').lean();
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }
        if (!event.foodSessionsEnabled) {
            return NextResponse.json(
                { error: 'Food sessions are not enabled for this event' },
                { status: 400 }
            );
        }

        const registration = await EventRegistration.findOne({ eventId: oid, email: normalizedEmail });
        if (!registration) {
            return NextResponse.json(
                { error: 'Not registered for this event', registered: false },
                { status: 404 }
            );
        }

        // Already holds a slot? Report which colour rather than moving them — a move is a
        // dashboard-only action.
        const existing = await FoodAssignment.findOne({ eventId: oid, email: normalizedEmail }).lean();
        if (existing) {
            const held = await FoodSession.findById(existing.foodSessionId).select('color').lean();
            return NextResponse.json(
                {
                    error: 'Attendee already has a food slot',
                    alreadyAssigned: true,
                    assignment: held
                        ? { sessionId: held._id, color: held.color, ...describeFoodColor(held.color) }
                        : null,
                },
                { status: 409 }
            );
        }

        const reserved = await reserveSeat(foodSessionId, eventId);
        if (!reserved) {
            const fresh = await FoodSession.findOne({ _id: foodSessionId, eventId: oid }).lean();
            if (!fresh) {
                return NextResponse.json({ error: 'Food session not found' }, { status: 404 });
            }
            if (!fresh.isVisible) {
                return NextResponse.json(
                    { error: 'Session not available', sessionUnavailable: true },
                    { status: 400 }
                );
            }
            return NextResponse.json(
                { error: 'Session is at full capacity', full: true, session: serializeFoodSession(fresh) },
                { status: 409 }
            );
        }

        try {
            const assignment = await FoodAssignment.create({
                eventId: oid,
                foodSessionId: new mongoose.Types.ObjectId(foodSessionId),
                email: normalizedEmail,
                regNo: registration.regNo,
                name: registration.name,
                assignedBy: new mongoose.Types.ObjectId(user.userId),
                assignedAt: new Date(),
            });

            return NextResponse.json(
                {
                    ok: true,
                    message: 'Food slot assigned',
                    assignment: {
                        id: assignment._id,
                        sessionId: reserved._id,
                        color: reserved.color,
                        ...describeFoodColor(reserved.color),
                    },
                    session: serializeFoodSession(reserved),
                },
                { status: 201 }
            );
        } catch (err: unknown) {
            // Two doors scanned the same person at once. Give the seat back and report the
            // colour that won.
            await releaseSeat(foodSessionId);
            if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
                const winner = await FoodAssignment.findOne({ eventId: oid, email: normalizedEmail }).lean();
                const held = winner
                    ? await FoodSession.findById(winner.foodSessionId).select('color').lean()
                    : null;
                return NextResponse.json(
                    {
                        error: 'Attendee already has a food slot',
                        alreadyAssigned: true,
                        assignment: held
                            ? { sessionId: held._id, color: held.color, ...describeFoodColor(held.color) }
                            : null,
                    },
                    { status: 409 }
                );
            }
            throw err;
        }
    } catch (error) {
        console.error('Error assigning food slot:', error);
        return NextResponse.json({ error: 'Failed to assign food slot' }, { status: 500 });
    }
}
