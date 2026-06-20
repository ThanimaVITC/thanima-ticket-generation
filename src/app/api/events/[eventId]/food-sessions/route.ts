import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import FoodSession from '@/lib/db/models/foodSession';
import { getAuthUser, requireRole, requireEventAccess } from '@/lib/auth/middleware';
import { computeFoodSessionStats } from '@/lib/food-session-stats';

// GET /api/events/[eventId]/food-sessions - List food sessions for an event.
// ?activeOnly=1 returns only visible sessions (used by the mobile scanner app).
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

        const event = await Event.findById(eventId).select('_id foodSessionsEnabled').lean();
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const activeOnly = req.nextUrl.searchParams.get('activeOnly');
        const filter: Record<string, unknown> = {
            eventId: new mongoose.Types.ObjectId(eventId),
        };
        if (activeOnly === '1' || activeOnly === 'true') {
            filter.isVisible = true;
        }

        const sessions = await FoodSession.find(filter).sort({ createdAt: 1 }).lean();

        const sessionsWithStats = sessions.map((s) => ({
            _id: s._id,
            eventId: s.eventId,
            name: s.name,
            limit: s.limit,
            maxLimit: s.maxLimit,
            isVisible: s.isVisible,
            count: s.count,
            createdAt: s.createdAt,
            stats: computeFoodSessionStats(s.count, s.limit, s.maxLimit),
        }));

        return NextResponse.json({
            foodSessionsEnabled: event.foodSessionsEnabled ?? false,
            sessions: sessionsWithStats,
        });
    } catch (error) {
        console.error('Error fetching food sessions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch food sessions' },
            { status: 500 }
        );
    }
}

// POST /api/events/[eventId]/food-sessions - Create a food session.
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

        const roleCheck = requireRole(user, 'admin', 'event_admin');
        if (roleCheck) return roleCheck;
        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        const body = await req.json();
        const { name, limit, maxLimit, isVisible } = body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'Session name is required' }, { status: 400 });
        }

        const limitNum = Number(limit);
        const maxLimitNum = Number(maxLimit);

        if (!Number.isInteger(limitNum) || limitNum < 0) {
            return NextResponse.json({ error: 'Limit must be a non-negative integer' }, { status: 400 });
        }
        if (!Number.isInteger(maxLimitNum) || maxLimitNum < 1) {
            return NextResponse.json({ error: 'Max limit must be an integer of at least 1' }, { status: 400 });
        }
        if (limitNum > maxLimitNum) {
            return NextResponse.json({ error: 'Limit cannot exceed max limit' }, { status: 400 });
        }

        await connectDB();

        const event = await Event.findById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const session = await FoodSession.create({
            eventId: new mongoose.Types.ObjectId(eventId),
            name: name.trim(),
            limit: limitNum,
            maxLimit: maxLimitNum,
            isVisible: typeof isVisible === 'boolean' ? isVisible : true,
            count: 0,
        });

        return NextResponse.json(
            { session, message: 'Food session created successfully' },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating food session:', error);
        return NextResponse.json(
            { error: 'Failed to create food session' },
            { status: 500 }
        );
    }
}
