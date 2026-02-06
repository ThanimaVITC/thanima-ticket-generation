import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectDB from '@/lib/db/connection';
import QuizResponse from '@/lib/db/models/quiz-response';
import { verifyPublicToken } from '@/lib/auth/public-jwt';

// GET /api/public/quiz/answered - Get questions the user has already answered
export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('public-auth-token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const user = verifyPublicToken(token);
        if (!user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        await connectDB();

        // Get all question IDs the user has answered
        const responses = await QuizResponse.find({
            eventId: user.eventId,
            regNo: user.regNo,
        }).select('questionId').lean();

        const answeredQuestionIds = responses.map((r) => r.questionId.toString());

        return NextResponse.json({
            answeredQuestionIds,
        });
    } catch (error) {
        console.error('Error fetching answered questions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch answered questions' },
            { status: 500 }
        );
    }
}
