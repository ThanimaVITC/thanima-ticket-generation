import { NextResponse } from 'next/server';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';

// GET /api/public/events - Get the active display event
export async function GET() {
    try {
        await connectDB();

        // Get only the event marked as active display
        const event = await Event.findOne({
            isActiveDisplay: true,
            isPublicDownload: true,
            'ticketTemplate.imagePath': { $exists: true, $ne: null },
        })
            .select('_id title date description ticketTemplate.imagePath')
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
