import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import Attendance from '@/lib/db/models/attendance';
import { resolveTemplateUrl } from '@/lib/s3';

// Replace each event's stored S3 key with a presigned, browser-loadable URL.
async function presignEvents<T extends { ticketTemplate?: { imagePath?: string } }>(
    events: T[]
): Promise<T[]> {
    return Promise.all(
        events.map(async (event) => {
            if (event.ticketTemplate?.imagePath) {
                event.ticketTemplate.imagePath = await resolveTemplateUrl(event.ticketTemplate.imagePath);
            }
            return event;
        })
    );
}

// GET /api/public/events - Get the active display event or a specific event by ID
export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const eventId = req.nextUrl.searchParams.get('eventId');

        // If eventId is provided, fetch that specific event
        if (eventId) {
            const event = await Event.findById(eventId)
                .select('_id title date description ticketTemplate.imagePath isPublicDownload isActiveDisplay')
                .lean();

            if (!event) {
                return NextResponse.json({ events: [], activeEvent: null });
            }

            const [presigned] = await presignEvents([event]);
            return NextResponse.json({ events: [presigned], activeEvent: presigned });
        }

        // Otherwise, list every event marked visible on the homepage.
        const events = await Event.find({
            isActiveDisplay: true,
        })
            .select('_id title date description ticketTemplate.imagePath isPublicDownload isActiveDisplay')
            .sort({ date: -1 })
            .lean();

        const presignedEvents = await presignEvents(events);

        // activeEvent kept for backward compatibility (first/most-recent).
        return NextResponse.json({ events: presignedEvents, activeEvent: presignedEvents[0] ?? null });
    } catch (error) {
        console.error('Public events fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch events' },
            { status: 500 }
        );
    }
}
