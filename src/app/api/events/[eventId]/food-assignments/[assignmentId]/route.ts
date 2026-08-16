import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import FoodSession from '@/lib/db/models/foodSession';
import FoodAssignment from '@/lib/db/models/foodAssignment';
import { getAuthUser, requireRole, requireEventAccess } from '@/lib/auth/middleware';
import { describeFoodColor } from '@/lib/food-colors';
import { serializeFoodSession } from '@/lib/food-session-stats';
import { reserveSeat, releaseSeat } from '@/lib/food-assignment';

// PATCH /api/events/[eventId]/food-assignments/[assignmentId]
// Move an attendee from one colour to another. Deliberately dashboard-only: the mobile
// app has no call site for this, and the role check keeps it that way.
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ eventId: string; assignmentId: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { eventId, assignmentId } = await params;
        if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(assignmentId)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const roleCheck = requireRole(user, 'admin', 'event_admin');
        if (roleCheck) return roleCheck;
        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        const body = await req.json();
        const { foodSessionId } = body;

        if (!foodSessionId || !mongoose.Types.ObjectId.isValid(foodSessionId)) {
            return NextResponse.json({ error: 'A valid foodSessionId is required' }, { status: 400 });
        }

        await connectDB();

        const oid = new mongoose.Types.ObjectId(eventId);

        const assignment = await FoodAssignment.findOne({ _id: assignmentId, eventId: oid });
        if (!assignment) {
            return NextResponse.json({ error: 'Food assignment not found' }, { status: 404 });
        }

        if (assignment.foodSessionId.toString() === foodSessionId) {
            return NextResponse.json({ ok: true, message: 'Already in that session' });
        }

        // Take the new seat first. If the target is full the attendee keeps the old one.
        const target = await reserveSeat(foodSessionId, eventId);
        if (!target) {
            const fresh = await FoodSession.findOne({ _id: foodSessionId, eventId: oid }).lean();
            if (!fresh) {
                return NextResponse.json({ error: 'Food session not found' }, { status: 404 });
            }
            return NextResponse.json(
                {
                    error: fresh.isVisible
                        ? 'That session is at full capacity — raise its max limit to move more people in'
                        : 'That session is hidden',
                    full: fresh.isVisible,
                    session: serializeFoodSession(fresh),
                },
                { status: 409 }
            );
        }

        const previousSessionId = assignment.foodSessionId;
        assignment.foodSessionId = new mongoose.Types.ObjectId(foodSessionId);
        // Any mail already sent names the old colour, so this person goes back in the
        // queue. One row, so the next run corrects them without spamming anybody else.
        assignment.emailStatus = 'pending';
        assignment.emailSentAt = null;
        try {
            await assignment.save();
        } catch (err) {
            // Hand the target seat back rather than leaking it to a half-done move.
            await releaseSeat(foodSessionId);
            throw err;
        }
        await releaseSeat(previousSessionId);

        return NextResponse.json({
            ok: true,
            message: 'Food slot changed',
            assignment: {
                id: assignment._id,
                sessionId: target._id,
                color: target.color,
                ...describeFoodColor(target.color),
            },
        });
    } catch (error) {
        console.error('Error changing food slot:', error);
        return NextResponse.json({ error: 'Failed to change food slot' }, { status: 500 });
    }
}

// DELETE - Remove an attendee's food slot entirely, handing the seat back.
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ eventId: string; assignmentId: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { eventId, assignmentId } = await params;
        if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(assignmentId)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const roleCheck = requireRole(user, 'admin', 'event_admin');
        if (roleCheck) return roleCheck;
        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        await connectDB();

        const assignment = await FoodAssignment.findOneAndDelete({
            _id: assignmentId,
            eventId: new mongoose.Types.ObjectId(eventId),
        });
        if (!assignment) {
            return NextResponse.json({ error: 'Food assignment not found' }, { status: 404 });
        }

        await releaseSeat(assignment.foodSessionId);

        return NextResponse.json({ ok: true, message: 'Food slot removed' });
    } catch (error) {
        console.error('Error removing food slot:', error);
        return NextResponse.json({ error: 'Failed to remove food slot' }, { status: 500 });
    }
}
