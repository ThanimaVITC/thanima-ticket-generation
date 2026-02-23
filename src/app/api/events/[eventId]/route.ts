import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import Attendance from '@/lib/db/models/attendance';
import { getAuthUser, requireRole, requireEventAccess } from '@/lib/auth/middleware';

// GET /api/events/[eventId] - Get event details with registrations and attendance
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

        const event = await Event.findById(eventId).lean();

        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Get registrations and attendance for this event
        const [registrations, attendanceRecords] = await Promise.all([
            EventRegistration.find({ eventId: new mongoose.Types.ObjectId(eventId) }).lean(),
            Attendance.find({ eventId: new mongoose.Types.ObjectId(eventId) }).lean(),
        ]);

        // Create a map of attendance by email
        const attendanceMap = new Map(
            attendanceRecords.map((a) => [a.email, { markedAt: a.markedAt, source: a.source }])
        );

        // Combine registrations with attendance status
        const registrationsWithAttendance = registrations.map((reg) => ({
            ...reg,
            attended: attendanceMap.has(reg.email),
            attendance: attendanceMap.get(reg.email) || null,
        }));

        const sentCount = registrations.filter((r) => r.emailStatus === 'sent').length;
        const totalRegistrations = registrations.length;
        const pendingCount = registrations.filter((r) => !r.emailStatus || r.emailStatus === 'pending').length;
        const failedCount = registrations.filter((r) => r.emailStatus === 'failed').length;

        return NextResponse.json({
            event,
            registrations: registrationsWithAttendance,
            stats: {
                totalRegistrations: registrations.length,
                totalAttendance: attendanceRecords.length,
                attendanceRate:
                    registrations.length > 0
                        ? Math.round((attendanceRecords.length / registrations.length) * 100)
                        : 0,
                emailStats: {
                    sentCount,
                    pendingCount,
                    failedCount,
                    emailSendRate: totalRegistrations > 0 ? Math.round((sentCount / totalRegistrations) * 100) : 0,
                },
            },
        });
    } catch (error) {
        console.error('Error fetching event:', error);
        return NextResponse.json(
            { error: 'Failed to fetch event' },
            { status: 500 }
        );
    }
}

// DELETE /api/events/[eventId] - Delete event
export async function DELETE(
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

        const roleCheck = requireRole(user, 'admin');
        if (roleCheck) return roleCheck;

        await connectDB();

        const event = await Event.findByIdAndDelete(eventId);

        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Also delete related registrations and attendance
        await Promise.all([
            EventRegistration.deleteMany({ eventId: new mongoose.Types.ObjectId(eventId) }),
            Attendance.deleteMany({ eventId: new mongoose.Types.ObjectId(eventId) }),
        ]);

        return NextResponse.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        return NextResponse.json(
            { error: 'Failed to delete event' },
            { status: 500 }
        );
    }
}
