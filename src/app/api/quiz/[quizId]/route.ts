import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connection';
import Quiz from '@/lib/db/models/quiz';
import { getAuthUser } from '@/lib/auth/middleware';
import mongoose from 'mongoose';

// GET /api/quiz/[quizId] - Get quiz details
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ quizId: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { quizId } = await params;
        await connectDB();

        const quiz = await Quiz.findById(quizId).lean();
        if (!quiz) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        return NextResponse.json({ quiz });
    } catch (error) {
        console.error('Error fetching quiz:', error);
        return NextResponse.json(
            { error: 'Failed to fetch quiz' },
            { status: 500 }
        );
    }
}

// PUT /api/quiz/[quizId] - Update quiz (toggle visibility, update title)
export async function PUT(
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
        const { isVisible, title } = body;

        await connectDB();

        const updateData: Record<string, unknown> = {};
        if (typeof isVisible === 'boolean') updateData.isVisible = isVisible;
        if (title) updateData.title = title;

        const quiz = await Quiz.findByIdAndUpdate(
            quizId,
            updateData,
            { new: true }
        ).lean();

        if (!quiz) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        return NextResponse.json({ quiz, message: 'Quiz updated successfully' });
    } catch (error) {
        console.error('Error updating quiz:', error);
        return NextResponse.json(
            { error: 'Failed to update quiz' },
            { status: 500 }
        );
    }
}

// DELETE /api/quiz/[quizId] - Delete quiz
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ quizId: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { quizId } = await params;
        await connectDB();

        const quiz = await Quiz.findByIdAndDelete(quizId);
        if (!quiz) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Quiz deleted successfully' });
    } catch (error) {
        console.error('Error deleting quiz:', error);
        return NextResponse.json(
            { error: 'Failed to delete quiz' },
            { status: 500 }
        );
    }
}
