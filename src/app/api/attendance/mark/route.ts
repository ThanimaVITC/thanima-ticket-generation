import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import Attendance from '@/lib/db/models/attendance';
import { getAuthUser } from '@/lib/auth/middleware';

// POST /api/attendance/mark - Mark attendance
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { eventId, email, source } = body;

        if (!eventId || !email) {
            return NextResponse.json(
                { error: 'eventId and email are required' },
                { status: 400 }
            );
        }

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
        }

        const validSources = ['web', 'mobile'];
        const attendanceSource = validSources.includes(source) ? source : 'web';

        // For web source, require authentication
        if (attendanceSource === 'web') {
            const user = await getAuthUser();
            if (!user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const normalizedEmail = email.trim().toLowerCase();

        await connectDB();

        // Verify event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Verify registration exists
        const registration = await EventRegistration.findOne({
            eventId: new mongoose.Types.ObjectId(eventId),
            email: normalizedEmail,
        });

        if (!registration) {
            return NextResponse.json(
                { error: 'Not registered for this event', registered: false },
                { status: 404 }
            );
        }

        // Check if already marked
        const existingAttendance = await Attendance.findOne({
            eventId: new mongoose.Types.ObjectId(eventId),
            email: normalizedEmail,
        });

        if (existingAttendance) {
            return NextResponse.json(
                {
                    error: 'Attendance already marked',
                    alreadyMarked: true,
                    markedAt: existingAttendance.markedAt,
                },
                { status: 409 }
            );
        }

        // Mark attendance
        const attendance = await Attendance.create({
            eventId: new mongoose.Types.ObjectId(eventId),
            email: normalizedEmail,
            source: attendanceSource,
            markedAt: new Date(),
        });

        return NextResponse.json({
            message: 'Attendance marked successfully',
            attendance: {
                email: attendance.email,
                markedAt: attendance.markedAt,
                source: attendance.source,
            },
        });
    } catch (error) {
        console.error('Attendance marking error:', error);
        return NextResponse.json(
            { error: 'Failed to mark attendance' },
            { status: 500 }
        );
    }
}
