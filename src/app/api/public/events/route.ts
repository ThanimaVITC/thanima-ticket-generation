import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import Quiz from '@/lib/db/models/quiz';

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

            // Check if there's a visible quiz for this event
            const hasVisibleQuiz = await Quiz.exists({ eventId: event._id, isVisible: true });

            const eventWithQuiz = { ...event, hasVisibleQuiz: !!hasVisibleQuiz };
            return NextResponse.json({ events: [eventWithQuiz], activeEvent: eventWithQuiz });
        }

        // Otherwise, get the event marked as active display
        const event = await Event.findOne({
            isActiveDisplay: true,
        })
            .select('_id title date description ticketTemplate.imagePath isPublicDownload')
            .lean();

        // Return as array for backward compatibility
        const events = event ? [event] : [];

        if (event) {
            // Check if there's a visible quiz for this event
            const hasVisibleQuiz = await Quiz.exists({ eventId: event._id, isVisible: true });
            const eventWithQuiz = { ...event, hasVisibleQuiz: !!hasVisibleQuiz };
            return NextResponse.json({ events: [eventWithQuiz], activeEvent: eventWithQuiz });
        }

        return NextResponse.json({ events, activeEvent: event });
    } catch (error) {
        console.error('Public events fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch events' },
            { status: 500 }
        );
    }
}
