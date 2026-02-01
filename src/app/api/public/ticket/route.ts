import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { createCanvas, loadImage } from 'canvas';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import path from 'path';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';

// POST /api/public/ticket - Download ticket for registered user
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

        if (!shouldReset && count >= 2) {
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

        // Load template image
        const templatePath = path.join(process.cwd(), 'public', event.ticketTemplate.imagePath);
        const templateImage = await loadImage(templatePath);

        // Create canvas with template dimensions
        const canvas = createCanvas(templateImage.width, templateImage.height);
        const ctx = canvas.getContext('2d');

        // Draw template
        ctx.drawImage(templateImage, 0, 0);

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

        const qrDataUrl = await QRCode.toDataURL(qrPayload as string, {
            width: event.ticketTemplate.qrPosition?.width || 200,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
        });
        const qrImage = await loadImage(qrDataUrl);

        // Draw QR code at configured position
        const qrPos = event.ticketTemplate.qrPosition || { x: 50, y: 50, width: 200, height: 200 };
        ctx.drawImage(qrImage, qrPos.x, qrPos.y, qrPos.width, qrPos.height);

        // Draw name at configured position
        const namePos = event.ticketTemplate.namePosition || { x: 50, y: 300, fontSize: 24, color: '#000000' };
        ctx.font = `bold ${namePos.fontSize}px Arial`;
        ctx.fillStyle = namePos.color;
        ctx.fillText(registration.name, namePos.x, namePos.y);



        // Return image as PNG
        const buffer = canvas.toBuffer('image/png');
        const uint8Array = new Uint8Array(buffer);

        // Generate filename: username_eventname.png
        const sanitizedName = registration.name.replace(/[^a-zA-Z0-9]/g, '_');
        const sanitizedEvent = event.title.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${sanitizedName}_${sanitizedEvent}.png`;

        return new NextResponse(uint8Array, {
            headers: {
                'Content-Type': 'image/png',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error('Ticket download error:', error);
        return NextResponse.json(
            { error: 'Failed to generate ticket' },
            { status: 500 }
        );
    }
}
