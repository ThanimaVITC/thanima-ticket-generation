import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectDB from '@/lib/db/connection';
import Quiz from '@/lib/db/models/quiz';
import QuizResponse from '@/lib/db/models/quiz-response';
import EventRegistration from '@/lib/db/models/registration';
import { verifyPublicToken } from '@/lib/auth/public-jwt';

// Points calculation: 10 - (timeTakenSeconds * 0.2), minimum 0
function calculatePoints(timeTakenMs: number, isCorrect: boolean): number {
    if (!isCorrect) return 0;
    const timeTakenSeconds = timeTakenMs / 1000;
    const points = 10 - (timeTakenSeconds * 0.2);
    return Math.max(0, Math.round(points * 100) / 100); // Round to 2 decimals
}

// POST /api/public/quiz/answer - Submit an answer
export async function POST(req: NextRequest) {
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

        const body = await req.json();
        const { quizId, questionId, selectedOptionIndex, timeTakenMs } = body;

        if (!quizId || !questionId || typeof selectedOptionIndex !== 'number' || typeof timeTakenMs !== 'number') {
            return NextResponse.json(
                { error: 'quizId, questionId, selectedOptionIndex, and timeTakenMs are required' },
                { status: 400 }
            );
        }

        if (selectedOptionIndex < 0 || selectedOptionIndex > 3) {
            return NextResponse.json(
                { error: 'selectedOptionIndex must be between 0 and 3' },
                { status: 400 }
            );
        }

        await connectDB();

        // Check if user already answered this question
        const existingResponse = await QuizResponse.findOne({
            quizId,
            questionId,
            regNo: user.regNo,
        });

        if (existingResponse) {
            return NextResponse.json(
                { error: 'You have already answered this question', alreadyAnswered: true },
                { status: 400 }
            );
        }

        // Get the quiz to verify the correct answer
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        const question = quiz.questions.find((q) => q._id.toString() === questionId);
        if (!question) {
            return NextResponse.json({ error: 'Question not found' }, { status: 404 });
        }

        // Check if question is still active
        if (!question.isActive) {
            return NextResponse.json(
                { error: 'This question is no longer active' },
                { status: 400 }
            );
        }

        // Check correctness and calculate points
        const isCorrect = selectedOptionIndex === question.correctOptionIndex;
        const points = calculatePoints(timeTakenMs, isCorrect);

        // Get user's name from registration
        const registration = await EventRegistration.findOne({
            eventId: user.eventId,
            regNo: user.regNo,
        });

        // Save the response
        const response = await QuizResponse.create({
            quizId,
            questionId,
            eventId: user.eventId,
            regNo: user.regNo,
            name: registration?.name || user.name,
            selectedOptionIndex,
            isCorrect,
            timeTakenMs,
            points,
        });

        // Don't reveal if answer was correct
        return NextResponse.json({
            success: true,
            message: 'Answer submitted successfully',
            responseId: response._id,
            // Do NOT include isCorrect or points to hide result from user
        });
    } catch (error) {
        // Handle duplicate key error (already answered)
        if ((error as { code?: number }).code === 11000) {
            return NextResponse.json(
                { error: 'You have already answered this question', alreadyAnswered: true },
                { status: 400 }
            );
        }
        console.error('Error submitting answer:', error);
        return NextResponse.json(
            { error: 'Failed to submit answer' },
            { status: 500 }
        );
    }
}
