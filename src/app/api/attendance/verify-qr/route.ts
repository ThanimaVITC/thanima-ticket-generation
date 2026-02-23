import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import Attendance from '@/lib/db/models/attendance';
import { getAuthUser, requireEventAccess } from '@/lib/auth/middleware';

// POST /api/attendance/verify-qr - Verify encrypted QR and mark attendance
export async function POST(req: NextRequest) {
    try {
        // Require authentication for QR verification
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { encryptedData, eventId: requestEventId } = body;

        if (!encryptedData || typeof encryptedData !== 'string') {
            return NextResponse.json(
                { error: 'encryptedData (hash) is required' },
                { status: 400 }
            );
        }

        // Check if eventId is provided (it should be, for validation)
        if (requestEventId && !mongoose.Types.ObjectId.isValid(requestEventId)) {
            return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
        }

        // Check event access if eventId is provided
        if (requestEventId) {
            const eventAccess = requireEventAccess(user, requestEventId);
            if (eventAccess) return eventAccess;
        }

        await connectDB();

        // Find registration by the QR hash (encryptedData)
        // Since we store the unique bcrypt hash string, we lookup by exact match
        const registration = await EventRegistration.findOne({
            qrPayload: encryptedData,
        });

        if (!registration) {
            return NextResponse.json(
                { error: 'Invalid QR code' },
                { status: 404 }
            );
        }

        // Validate that this QR belongs to the requested event
        if (requestEventId && registration.eventId.toString() !== requestEventId) {
            return NextResponse.json(
                { error: 'This QR code is for a different event' },
                { status: 400 }
            );
        }

        const eventId = registration.eventId;
        const normalizedEmail = registration.email;

        // Verify event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Check if already marked
        const existingAttendance = await Attendance.findOne({
            eventId: eventId,
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

        const attendance = await Attendance.create({
            eventId: eventId,
            email: normalizedEmail,
            source: 'mobile',
            markedAt: new Date(),
        });

        return NextResponse.json({
            message: 'Attendance marked successfully',
            attendance: {
                id: attendance._id,
                email: attendance.email,
                name: registration.name,
                regNo: registration.regNo,
                markedAt: attendance.markedAt,
                source: attendance.source,
                eventId: eventId,
                eventTitle: event.title,
            },
        });
    } catch (error) {
        console.error('QR verification error:', error);
        return NextResponse.json(
            { error: 'Failed to verify QR code' },
            { status: 500 }
        );
    }
}
