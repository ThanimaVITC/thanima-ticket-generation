import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';

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

            return NextResponse.json({ events: [event], activeEvent: event });
        }

        // Otherwise, get the event marked as active display
        const event = await Event.findOne({
            isActiveDisplay: true,
        })
            .select('_id title date description ticketTemplate.imagePath isPublicDownload')
            .lean();

        // Return as array for backward compatibility
        const events = event ? [event] : [];

        return NextResponse.json({ events, activeEvent: event });
    } catch (error) {
        console.error('Public events fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch events' },
            { status: 500 }
        );
    }
}
