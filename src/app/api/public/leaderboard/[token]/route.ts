import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Quiz from '@/lib/db/models/quiz';
import QuizResponse from '@/lib/db/models/quiz-response';

// GET /api/public/leaderboard/[token] - Get leaderboard for a quiz using public token
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ token: string }> }
) {
    try {
        const params = await props.params;
        const { token } = params;

        await connectDB();

        // Find quiz by token
        const quiz = await Quiz.findOne({ leaderboardToken: token }).select('_id title eventId');

        if (!quiz) {
            return NextResponse.json({ error: 'Invalid leaderboard token' }, { status: 404 });
        }

        // Aggregate points by regNo
        const leaderboard = await QuizResponse.aggregate([
            { $match: { quizId: quiz._id } },
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

        return NextResponse.json({
            quizTitle: quiz.title,
            leaderboard
        });
    } catch (error) {
        console.error('Error fetching public leaderboard:', error);
        return NextResponse.json(
            { error: 'Failed to fetch leaderboard' },
            { status: 500 }
        );
    }
}
