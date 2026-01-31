import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import { getAuthUser } from '@/lib/auth/middleware';

// GET /api/events - List all events
export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        const searchParams = req.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const skip = (page - 1) * limit;

        const [events, total] = await Promise.all([
            Event.find()
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Event.countDocuments(),
        ]);

        return NextResponse.json({
            events,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        return NextResponse.json(
            { error: 'Failed to fetch events' },
            { status: 500 }
        );
    }
}

// POST /api/events - Create new event
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { title, description, date } = body;

        if (!title || !date) {
            return NextResponse.json(
                { error: 'Title and date are required' },
                { status: 400 }
            );
        }

        await connectDB();

        const event = await Event.create({
            title,
            description: description || '',
            date: new Date(date),
        });

        return NextResponse.json(
            { event, message: 'Event created successfully' },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating event:', error);
        return NextResponse.json(
            { error: 'Failed to create event' },
            { status: 500 }
        );
    }
}
