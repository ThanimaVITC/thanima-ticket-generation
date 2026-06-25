import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import Attendance from '@/lib/db/models/attendance';
import { getAuthUser, requireRole, requireEventAccess } from '@/lib/auth/middleware';

// GET /api/events/[eventId]/attendees - name + regNo of attendees who attended (picker pool)
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

        // Picker is admin / event_admin only (matches the page's client gate).
        const roleCheck = requireRole(user, 'admin', 'event_admin');
        if (roleCheck) return roleCheck;

        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        await connectDB();

        const objId = new mongoose.Types.ObjectId(eventId);

        const event = await Event.findById(eventId, { title: 1 }).lean();
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const attendedEmails = await Attendance.distinct('email', { eventId: objId });
        const attendees = await EventRegistration.find(
            { eventId: objId, email: { $in: attendedEmails } },
            { name: 1, regNo: 1, _id: 1 }
        ).lean();

        return NextResponse.json({ event: { title: event.title }, attendees });
    } catch (error) {
        console.error('Error fetching attendees:', error);
        return NextResponse.json({ error: 'Failed to fetch attendees' }, { status: 500 });
    }
}
