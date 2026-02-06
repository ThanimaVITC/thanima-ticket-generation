import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connection';
import Quiz from '@/lib/db/models/quiz';
import { getAuthUser } from '@/lib/auth/middleware';

// GET /api/quiz - List quizzes (optionally filter by eventId)
export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        const searchParams = req.nextUrl.searchParams;
        const eventId = searchParams.get('eventId');

        const query = eventId ? { eventId } : {};
        const quizzes = await Quiz.find(query)
            .sort({ createdAt: -1 })
            .lean();

        return NextResponse.json({ quizzes });
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        return NextResponse.json(
            { error: 'Failed to fetch quizzes' },
            { status: 500 }
        );
    }
}

// POST /api/quiz - Create a new quiz
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { eventId, title } = body;

        if (!eventId || !title) {
            return NextResponse.json(
                { error: 'Event ID and title are required' },
                { status: 400 }
            );
        }

        await connectDB();

        const quiz = await Quiz.create({
            eventId,
            title,
            isVisible: false,
            questions: [],
        });

        return NextResponse.json(
            { quiz, message: 'Quiz created successfully' },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating quiz:', error);
        return NextResponse.json(
            { error: 'Failed to create quiz' },
            { status: 500 }
        );
    }
}
