import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';

// POST /api/public/ticket - Get ticket data for client-side generation
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { eventId, email, phone } = body;

        if (!eventId || !email || !phone) {
            return NextResponse.json(
                { error: 'eventId, email, and phone are required' },
                { status: 400 }
            );
        }

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const trimmedPhone = phone.trim();

        await connectDB();

        // Verify event exists and has public download enabled
        const event = await Event.findById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        if (!event.isPublicDownload) {
            return NextResponse.json(
                { error: 'Ticket download is not available for this event' },
                { status: 403 }
            );
        }

        if (!event.ticketTemplate?.imagePath) {
            return NextResponse.json(
                { error: 'Ticket template not configured for this event' },
                { status: 400 }
            );
        }

        // Find registration matching email AND phone
        const registration = await EventRegistration.findOne({
            eventId: new mongoose.Types.ObjectId(eventId),
            email: normalizedEmail,
            phone: trimmedPhone,
        });

        if (!registration) {
            return NextResponse.json(
                { error: 'No registration found with the provided email and phone' },
                { status: 404 }
            );
        }

        // Rate Limit Check (2 downloads per minute)
        const now = new Date();
        const windowStart = registration.rateLimitWindowStart ? new Date(registration.rateLimitWindowStart) : new Date(0);
        const count = registration.rateLimitCount || 0;

        const shouldReset = now.getTime() - windowStart.getTime() > 60000;

        if (!shouldReset && count >= 100) {
            return NextResponse.json(
                { error: 'Download limit reached. Please try after 1 min' },
                { status: 429 }
            );
        }

        const update: any = { $inc: { downloadCount: 1 } };
        if (shouldReset) {
            update.rateLimitWindowStart = now;
            update.rateLimitCount = 1;
        } else {
            update.rateLimitCount = count + 1;
        }

        await EventRegistration.findByIdAndUpdate(registration._id, update);

        // Get or generate QR payload hash (generate once and reuse)
        let qrPayload = registration.qrPayload;
        if (!qrPayload) {
            // Generate hash if missing (backfill)
            const qrInput = `${normalizedEmail}:${registration.phone}`;
            qrPayload = await bcrypt.hash(qrInput, 10);

            // Store the payload for future use
            await EventRegistration.findByIdAndUpdate(registration._id, {
                qrPayload,
            });
        }

        // Return ticket data for client-side generation
        return NextResponse.json({
            qrPayload,
            name: registration.name,
            regNo: registration.regNo,
            templateUrl: event.ticketTemplate.imagePath,
            qrPosition: event.ticketTemplate.qrPosition || { x: 50, y: 50, width: 200, height: 200 },
            namePosition: event.ticketTemplate.namePosition || { x: 50, y: 300, fontSize: 24, color: '#000000' },
            regNoPosition: event.ticketTemplate.regNoPosition || { x: 50, y: 350, fontSize: 18, color: '#000000' },
            eventTitle: event.title,
        });
    } catch (error) {
        console.error('Ticket data error:', error);
        return NextResponse.json(
            { error: 'Failed to get ticket data' },
            { status: 500 }
        );
    }
}
