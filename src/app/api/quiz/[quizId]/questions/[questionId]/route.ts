import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connection';
import Quiz from '@/lib/db/models/quiz';
import { getAuthUser } from '@/lib/auth/middleware';

// PUT /api/quiz/[quizId]/questions/[questionId] - Update question (toggle active, edit content)
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { quizId, questionId } = await params;
        const body = await req.json();
        const { isActive, text, options, correctOptionIndex } = body;

        await connectDB();

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        const questionIndex = quiz.questions.findIndex(
            (q) => q._id.toString() === questionId
        );

        if (questionIndex === -1) {
            return NextResponse.json({ error: 'Question not found' }, { status: 404 });
        }

        // If setting this question as active, deactivate all others first
        if (isActive === true) {
            quiz.questions.forEach((q) => {
                q.isActive = false;
            });
        }

        // Update the question
        if (typeof isActive === 'boolean') {
            quiz.questions[questionIndex].isActive = isActive;
        }
        if (text) {
            quiz.questions[questionIndex].text = text;
        }
        if (options && Array.isArray(options) && options.length === 4) {
            quiz.questions[questionIndex].options = options;
        }
        if (typeof correctOptionIndex === 'number' && correctOptionIndex >= 0 && correctOptionIndex <= 3) {
            quiz.questions[questionIndex].correctOptionIndex = correctOptionIndex;
        }

        await quiz.save();

        return NextResponse.json({
            question: quiz.questions[questionIndex],
            message: 'Question updated successfully',
        });
    } catch (error) {
        console.error('Error updating question:', error);
        return NextResponse.json(
            { error: 'Failed to update question' },
            { status: 500 }
        );
    }
}

// DELETE /api/quiz/[quizId]/questions/[questionId] - Delete a question
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { quizId, questionId } = await params;
        await connectDB();

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        const questionIndex = quiz.questions.findIndex(
            (q) => q._id.toString() === questionId
        );

        if (questionIndex === -1) {
            return NextResponse.json({ error: 'Question not found' }, { status: 404 });
        }

        quiz.questions.splice(questionIndex, 1);
        await quiz.save();

        return NextResponse.json({ message: 'Question deleted successfully' });
    } catch (error) {
        console.error('Error deleting question:', error);
        return NextResponse.json(
            { error: 'Failed to delete question' },
            { status: 500 }
        );
    }
}
