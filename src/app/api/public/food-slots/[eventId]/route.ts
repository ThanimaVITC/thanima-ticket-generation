import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import FoodSession from '@/lib/db/models/foodSession';
import { describeFoodColor } from '@/lib/food-colors';
import { describeSessionTiming } from '@/lib/food-session-stats';

// GET /api/public/food-slots/[eventId] — the slots board shown on a screen in the hall.
// No auth: it hangs on a wall. Only what a queueing attendee needs goes over the wire —
// seats left against the soft limit, never the overflow buffer or who holds a slot.
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
        }

        await connectDB();

        const event = await Event.findById(eventId).select('title foodSessionsEnabled').lean();
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const sessions = event.foodSessionsEnabled
            ? await FoodSession.find({
                  eventId: new mongoose.Types.ObjectId(eventId),
                  isVisible: true,
                  showInStats: { $ne: false },
              })
                  .sort({ startTime: 1, createdAt: 1 })
                  .lean()
            : [];

        return NextResponse.json({
            eventTitle: event.title,
            foodSessionsEnabled: event.foodSessionsEnabled ?? false,
            sessions: sessions.map((s) => ({
                _id: s._id,
                ...describeFoodColor(s.color),
                timing: describeSessionTiming(s.startTime, s.endTime),
                remaining: Math.max(0, s.limit - s.count),
                full: s.count >= s.limit,
            })),
        });
    } catch (error) {
        console.error('Error fetching public food slots:', error);
        return NextResponse.json({ error: 'Failed to load food slots' }, { status: 500 });
    }
}
