import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connection';
import Quiz from '@/lib/db/models/quiz';

const EVENT_ID_REGEX = /^[a-f0-9]{24}$/;

// GET /api/public/quiz/status/[eventId] - CDN-cacheable active quiz endpoint
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ eventId: string }> }
) {
    try {
        const params = await props.params;
        const { eventId } = params;

        if (!EVENT_ID_REGEX.test(eventId)) {
            return NextResponse.json(
                { error: 'Invalid event ID format' },
                { status: 400, headers: { 'Cache-Control': 'no-store' } }
            );
        }

        await connectDB();

        // Find visible quiz for this event
        const quiz = await Quiz.findOne({
            eventId,
            isVisible: true,
        }).lean();

        if (!quiz) {
            return NextResponse.json(
                {
                    hasQuiz: false,
                    message: 'No active quiz available',
                },
                {
                    headers: {
                        'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=10',
                    },
                }
            );
        }

        // Find the currently active question
        const activeQuestion = quiz.questions.find((q) => q.isActive);

        if (!activeQuestion) {
            return NextResponse.json(
                {
                    hasQuiz: true,
                    quizId: quiz._id,
                    quizTitle: quiz.title,
                    activeQuestion: null,
                    message: 'No question is currently active',
                },
                {
                    headers: {
                        'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=10',
                    },
                }
            );
        }

        // Return question without correct answer
        return NextResponse.json(
            {
                hasQuiz: true,
                quizId: quiz._id,
                quizTitle: quiz.title,
                activeQuestion: {
                    _id: activeQuestion._id,
                    text: activeQuestion.text,
                    options: activeQuestion.options,
                    // Do NOT include correctOptionIndex
                },
            },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=10',
                },
            }
        );
    } catch (error) {
        console.error('Error fetching active quiz:', error);
        return NextResponse.json(
            { error: 'Failed to fetch quiz' },
            { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
    }
}
