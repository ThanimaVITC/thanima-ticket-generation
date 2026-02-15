import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import { getAuthUser } from '@/lib/auth/middleware';

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const eventId = req.nextUrl.searchParams.get('eventId');
        if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: 'Valid eventId is required' }, { status: 400 });
        }

        await connectDB();

        const event = await Event.findById(eventId).select('emailTemplate title');
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        return NextResponse.json({
            subject: event.emailTemplate?.subject || 'Your Ticket for {{eventTitle}}',
            body: event.emailTemplate?.body || '',
        });
    } catch (error) {
        console.error('Get email template error:', error);
        return NextResponse.json({ error: 'Failed to get email template' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { eventId, subject, body: emailBody } = body;

        if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: 'Valid eventId is required' }, { status: 400 });
        }

        await connectDB();

        const event = await Event.findByIdAndUpdate(
            eventId,
            {
                emailTemplate: {
                    subject: subject || 'Your Ticket for {{eventTitle}}',
                    body: emailBody || '',
                },
            },
            { new: true }
        );

        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        return NextResponse.json({
            message: 'Email template saved',
            subject: event.emailTemplate?.subject,
            body: event.emailTemplate?.body,
        });
    } catch (error) {
        console.error('Save email template error:', error);
        return NextResponse.json({ error: 'Failed to save email template' }, { status: 500 });
    }
}
