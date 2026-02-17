import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import Attendance from '@/lib/db/models/attendance';
import { getAuthUser } from '@/lib/auth/middleware';

// POST /api/tickets/verify - Verify a ticket without marking attendance
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { qrPayload, eventId } = body;

        if (!qrPayload || typeof qrPayload !== 'string') {
            return NextResponse.json(
                { error: 'qrPayload is required' },
                { status: 400 }
            );
        }

        if (eventId && !mongoose.Types.ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
        }

        await connectDB();

        // Find registration by QR payload
        const registration = await EventRegistration.findOne({ qrPayload });

        if (!registration) {
            return NextResponse.json(
                { error: 'Invalid ticket - no registration found for this QR code' },
                { status: 404 }
            );
        }

        // Validate that this ticket belongs to the requested event
        if (eventId && registration.eventId.toString() !== eventId) {
            return NextResponse.json(
                { error: 'This ticket belongs to a different event' },
                { status: 400 }
            );
        }

        // Verify event exists
        const event = await Event.findById(registration.eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Check attendance status (read-only, does NOT mark attendance)
        const existingAttendance = await Attendance.findOne({
            eventId: registration.eventId,
            email: registration.email,
        });

        return NextResponse.json({
            ticket: {
                name: registration.name,
                regNo: registration.regNo,
                email: registration.email,
                phone: registration.phone,
                hasAttended: !!existingAttendance,
                attendedAt: existingAttendance?.markedAt ?? null,
                eventTitle: event.title,
            },
        });
    } catch (error) {
        console.error('Ticket verification error:', error);
        return NextResponse.json(
            { error: 'Failed to verify ticket' },
            { status: 500 }
        );
    }
}
