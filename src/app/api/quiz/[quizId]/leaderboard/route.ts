import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connection';
import QuizResponse from '@/lib/db/models/quiz-response';
import { getAuthUser } from '@/lib/auth/middleware';

// GET /api/quiz/[quizId]/leaderboard - Get leaderboard for a quiz
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

        // Aggregate points by regNo
        const leaderboard = await QuizResponse.aggregate([
            { $match: { quizId: quizId } },
            {
                $group: {
                    _id: '$regNo',
                    name: { $first: '$name' },
                    totalPoints: { $sum: '$points' },
                    correctAnswers: { $sum: { $cond: ['$isCorrect', 1, 0] } },
                    totalAnswers: { $sum: 1 },
                    avgTimeMs: { $avg: '$timeTakenMs' },
                },
            },
            { $sort: { totalPoints: -1, avgTimeMs: 1 } },
            {
                $project: {
                    _id: 0,
                    regNo: '$_id',
                    name: 1,
                    totalPoints: { $round: ['$totalPoints', 2] },
                    correctAnswers: 1,
                    totalAnswers: 1,
                    avgTimeMs: { $round: ['$avgTimeMs', 0] },
                },
            },
        ]);

        return NextResponse.json({ leaderboard });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json(
            { error: 'Failed to fetch leaderboard' },
            { status: 500 }
        );
    }
}
