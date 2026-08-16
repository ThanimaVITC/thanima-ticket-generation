import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import { getAuthUser, requireEventAccess } from '@/lib/auth/middleware';
import {
    DEFAULT_FOOD_EMAIL_SUBJECT as DEFAULT_SUBJECT,
    DEFAULT_FOOD_EMAIL_BODY,
} from '@/lib/email';

// GET/PATCH /api/food-emails/template?eventId=...
// The editable subject and body for the food colour mail, kept on the event exactly
// like the ticket template so both are edited the same way.
export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const eventId = req.nextUrl.searchParams.get('eventId');
        if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: 'Valid eventId is required' }, { status: 400 });
        }

        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        await connectDB();

        const event = await Event.findById(eventId).select('foodEmailTemplate').lean();
        if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

        return NextResponse.json({
            subject: event.foodEmailTemplate?.subject || DEFAULT_SUBJECT,
            body: event.foodEmailTemplate?.body || DEFAULT_FOOD_EMAIL_BODY,
        });
    } catch (error) {
        console.error('Get food email template error:', error);
        return NextResponse.json({ error: 'Failed to get the template' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { eventId, subject, body: emailBody } = await req.json();

        if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: 'Valid eventId is required' }, { status: 400 });
        }

        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        await connectDB();

        const event = await Event.findByIdAndUpdate(
            eventId,
            {
                foodEmailTemplate: {
                    subject: subject || DEFAULT_SUBJECT,
                    body: emailBody || DEFAULT_FOOD_EMAIL_BODY,
                },
            },
            { new: true }
        );

        if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

        return NextResponse.json({
            message: 'Template saved',
            subject: event.foodEmailTemplate?.subject,
            body: event.foodEmailTemplate?.body,
        });
    } catch (error) {
        console.error('Save food email template error:', error);
        return NextResponse.json({ error: 'Failed to save the template' }, { status: 500 });
    }
}
