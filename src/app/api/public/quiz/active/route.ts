import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectDB from '@/lib/db/connection';
import Quiz from '@/lib/db/models/quiz';
import { verifyPublicToken } from '@/lib/auth/public-jwt';

// GET /api/public/quiz/active - Get the active question for an event
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

        // Find visible quiz for this event
        const quiz = await Quiz.findOne({
            eventId: user.eventId,
            isVisible: true,
        }).lean();

        if (!quiz) {
            return NextResponse.json({
                hasQuiz: false,
                message: 'No active quiz available',
            });
        }

        // Find the currently active question
        const activeQuestion = quiz.questions.find((q) => q.isActive);

        if (!activeQuestion) {
            return NextResponse.json({
                hasQuiz: true,
                quizId: quiz._id,
                quizTitle: quiz.title,
                activeQuestion: null,
                message: 'No question is currently active',
            });
        }

        // Return question without correct answer
        return NextResponse.json({
            hasQuiz: true,
            quizId: quiz._id,
            quizTitle: quiz.title,
            activeQuestion: {
                _id: activeQuestion._id,
                text: activeQuestion.text,
                options: activeQuestion.options,
                // Do NOT include correctOptionIndex
            },
        });
    } catch (error) {
        console.error('Error fetching active quiz:', error);
        return NextResponse.json(
            { error: 'Failed to fetch quiz' },
            { status: 500 }
        );
    }
}
