import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import UserPoolEntry from '@/lib/db/models/userPoolEntry';
import { getAuthUser, requireEventAccess } from '@/lib/auth/middleware';

// GET /api/events/[eventId]/user-pool?status=active|all
//
// One endpoint serves both cards on both platforms:
//   status=active (default) -> who is in the pool right now
//   status=all              -> everyone who has ever used the pool
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

        const event = await Event.findById(eventId).select('_id userPoolEnabled').lean();
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const eventObjectId = new mongoose.Types.ObjectId(eventId);
        const status = req.nextUrl.searchParams.get('status');
        const activeOnly = status !== 'all';

        const filter: Record<string, unknown> = { eventId: eventObjectId };
        if (activeOnly) {
            filter.exitedAt = null;
        }

        const [rows, currentCount, totalVisits, distinctEmails] = await Promise.all([
            UserPoolEntry.find(filter).sort({ enteredAt: -1 }).lean(),
            UserPoolEntry.countDocuments({ eventId: eventObjectId, exitedAt: null }),
            UserPoolEntry.countDocuments({ eventId: eventObjectId }),
            UserPoolEntry.distinct('email', { eventId: eventObjectId }),
        ]);

        const now = Date.now();
        const entries = rows.map((e) => ({
            _id: e._id,
            registrationId: e.registrationId,
            name: e.name,
            regNo: e.regNo,
            email: e.email,
            phone: e.phone,
            nfcId: e.nfcId,
            enteredAt: e.enteredAt,
            exitedAt: e.exitedAt,
            // For active stays this is "so far"; clients tick it forward locally.
            durationMs: (e.exitedAt ? new Date(e.exitedAt).getTime() : now) - new Date(e.enteredAt).getTime(),
        }));

        return NextResponse.json({
            userPoolEnabled: event.userPoolEnabled ?? false,
            entries,
            stats: {
                currentCount,
                totalVisits,
                uniqueUsers: distinctEmails.length,
            },
        });
    } catch (error) {
        console.error('Error fetching user pool:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user pool' },
            { status: 500 }
        );
    }
}
