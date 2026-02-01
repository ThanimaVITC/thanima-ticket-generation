import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import { getAuthUser } from '@/lib/auth/middleware';

// GET /api/qr/[eventId]/[email] - Generate QR code for user
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ eventId: string; email: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { eventId, email } = await params;
        const decodedEmail = decodeURIComponent(email).toLowerCase();

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
        }

        await connectDB();

        // Verify event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Verify registration exists
        const registration = await EventRegistration.findOne({
            eventId: new mongoose.Types.ObjectId(eventId),
            email: decodedEmail,
        });

        if (!registration) {
            return NextResponse.json(
                { error: 'Email not registered for this event' },
                { status: 404 }
            );
        }

        // Get or generate QR payload hash (generate once and reuse)
        let qrPayload = registration.qrPayload;
        if (!qrPayload) {
            // Generate hash if missing (backfill)
            const qrInput = `${decodedEmail}:${registration.phone}`;
            qrPayload = await bcrypt.hash(qrInput, 10);

            // Store the payload for future use
            await EventRegistration.findByIdAndUpdate(registration._id, {
                qrPayload,
            });
        }

        const qrCodeDataUrl = await QRCode.toDataURL(qrPayload as string, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff',
            },
        });

        return NextResponse.json({
            qrCode: qrCodeDataUrl,
            payload: {
                eventId,
                email: decodedEmail,
                eventTitle: event.title,
            },
        });
    } catch (error) {
        console.error('QR generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate QR code' },
            { status: 500 }
        );
    }
}
