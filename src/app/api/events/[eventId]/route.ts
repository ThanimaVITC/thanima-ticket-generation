import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import Attendance from '@/lib/db/models/attendance';
import FoodScan from '@/lib/db/models/foodScan';
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

        // Get registrations, attendance, and food-scan count for this event
        const [registrations, attendanceRecords, foodScanCount] = await Promise.all([
            EventRegistration.find({ eventId: new mongoose.Types.ObjectId(eventId) }).lean(),
            Attendance.find({ eventId: new mongoose.Types.ObjectId(eventId) }).lean(),
            FoodScan.countDocuments({ eventId: new mongoose.Types.ObjectId(eventId) }),
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
                foodScanCount,
                foodScanRate:
                    registrations.length > 0
                        ? Math.round((foodScanCount / registrations.length) * 100)
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

// PATCH /api/events/[eventId] - Update event details (title, description, date)
export async function PATCH(
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

        // Only admins and event_admins may edit event details
        const roleCheck = requireRole(user, 'admin', 'event_admin');
        if (roleCheck) return roleCheck;

        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        const body = await req.json();
        const { title, description, date } = body;

        const updateFields: Record<string, unknown> = {};

        if (title !== undefined) {
            if (typeof title !== 'string' || title.trim().length === 0) {
                return NextResponse.json({ error: 'Title is required' }, { status: 400 });
            }
            updateFields.title = title.trim();
        }

        if (description !== undefined) {
            if (typeof description !== 'string') {
                return NextResponse.json({ error: 'Invalid description' }, { status: 400 });
            }
            updateFields.description = description.trim();
        }

        if (date !== undefined) {
            const parsedDate = new Date(date);
            if (isNaN(parsedDate.getTime())) {
                return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
            }
            updateFields.date = parsedDate;
        }

        if (Object.keys(updateFields).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        await connectDB();

        const event = await Event.findByIdAndUpdate(eventId, updateFields, {
            new: true,
            runValidators: true,
        }).lean();

        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        return NextResponse.json({ event, message: 'Event updated successfully' });
    } catch (error) {
        console.error('Error updating event:', error);
        return NextResponse.json(
            { error: 'Failed to update event' },
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
