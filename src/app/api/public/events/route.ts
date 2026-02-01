import { NextResponse } from 'next/server';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';

// GET /api/public/events - Get events with public download enabled
export async function GET() {
    try {
        await connectDB();

        const events = await Event.find({
            isPublicDownload: true,
            'ticketTemplate.imagePath': { $exists: true, $ne: null },
        })
            .select('_id title date ticketTemplate.imagePath')
            .sort({ date: -1 })
            .lean();

        return NextResponse.json({ events });
    } catch (error) {
        console.error('Public events fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch events' },
            { status: 500 }
        );
    }
}
