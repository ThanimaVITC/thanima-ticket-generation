import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connection';
import Quiz from '@/lib/db/models/quiz';
import { getAuthUser } from '@/lib/auth/middleware';
import mongoose from 'mongoose';

// POST /api/quiz/[quizId]/questions - Add a question to the quiz
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ quizId: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { quizId } = await params;
        const body = await req.json();
        const { text, options, correctOptionIndex } = body;

        if (!text || !options || typeof correctOptionIndex !== 'number') {
            return NextResponse.json(
                { error: 'Text, options, and correctOptionIndex are required' },
                { status: 400 }
            );
        }

        if (!Array.isArray(options) || options.length !== 4) {
            return NextResponse.json(
                { error: 'Exactly 4 options are required' },
                { status: 400 }
            );
        }

        if (correctOptionIndex < 0 || correctOptionIndex > 3) {
            return NextResponse.json(
                { error: 'correctOptionIndex must be between 0 and 3' },
                { status: 400 }
            );
        }

        await connectDB();

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        const newQuestion = {
            _id: new mongoose.Types.ObjectId(),
            text,
            options,
            correctOptionIndex,
            order: quiz.questions.length,
            isActive: false,
        };

        quiz.questions.push(newQuestion);
        await quiz.save();

        return NextResponse.json(
            { question: newQuestion, message: 'Question added successfully' },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error adding question:', error);
        return NextResponse.json(
            { error: 'Failed to add question' },
            { status: 500 }
        );
    }
}
