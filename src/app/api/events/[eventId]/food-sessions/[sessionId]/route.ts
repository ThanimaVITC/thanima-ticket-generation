import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import FoodSession from '@/lib/db/models/foodSession';
import FoodScan from '@/lib/db/models/foodScan';
import { getAuthUser, requireRole, requireEventAccess } from '@/lib/auth/middleware';

// PATCH /api/events/[eventId]/food-sessions/[sessionId]
// Edit name/limit/maxLimit and/or hide-unhide (isVisible).
export async function PATCH(
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

        const roleCheck = requireRole(user, 'admin', 'event_admin');
        if (roleCheck) return roleCheck;
        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        await connectDB();

        const session = await FoodSession.findOne({
            _id: new mongoose.Types.ObjectId(sessionId),
            eventId: new mongoose.Types.ObjectId(eventId),
        });
        if (!session) {
            return NextResponse.json({ error: 'Food session not found' }, { status: 404 });
        }

        const body = await req.json();
        const { name, limit, maxLimit, isVisible } = body;

        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0) {
                return NextResponse.json({ error: 'Session name is required' }, { status: 400 });
            }
            session.name = name.trim();
        }

        if (limit !== undefined) {
            const limitNum = Number(limit);
            if (!Number.isInteger(limitNum) || limitNum < 0) {
                return NextResponse.json({ error: 'Limit must be a non-negative integer' }, { status: 400 });
            }
            session.limit = limitNum;
        }

        if (maxLimit !== undefined) {
            const maxLimitNum = Number(maxLimit);
            if (!Number.isInteger(maxLimitNum) || maxLimitNum < 1) {
                return NextResponse.json({ error: 'Max limit must be an integer of at least 1' }, { status: 400 });
            }
            session.maxLimit = maxLimitNum;
        }

        if (session.limit > session.maxLimit) {
            return NextResponse.json({ error: 'Limit cannot exceed max limit' }, { status: 400 });
        }

        if (isVisible !== undefined) {
            if (typeof isVisible !== 'boolean') {
                return NextResponse.json({ error: 'isVisible must be a boolean' }, { status: 400 });
            }
            session.isVisible = isVisible;
        }

        await session.save();

        return NextResponse.json({ session, message: 'Food session updated successfully' });
    } catch (error) {
        console.error('Error updating food session:', error);
        return NextResponse.json(
            { error: 'Failed to update food session' },
            { status: 500 }
        );
    }
}

// DELETE /api/events/[eventId]/food-sessions/[sessionId]
// Deletes the session and cascade-deletes its scan records.
export async function DELETE(
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

        const roleCheck = requireRole(user, 'admin', 'event_admin');
        if (roleCheck) return roleCheck;
        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        await connectDB();

        const session = await FoodSession.findOneAndDelete({
            _id: new mongoose.Types.ObjectId(sessionId),
            eventId: new mongoose.Types.ObjectId(eventId),
        });
        if (!session) {
            return NextResponse.json({ error: 'Food session not found' }, { status: 404 });
        }

        await FoodScan.deleteMany({ foodSessionId: new mongoose.Types.ObjectId(sessionId) });

        return NextResponse.json({ message: 'Food session deleted successfully' });
    } catch (error) {
        console.error('Error deleting food session:', error);
        return NextResponse.json(
            { error: 'Failed to delete food session' },
            { status: 500 }
        );
    }
}
