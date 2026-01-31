import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Attendance from '@/lib/db/models/attendance';
import { getAuthUser } from '@/lib/auth/middleware';

// GET /api/attendance/[eventId] - Get attendance list for event
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { eventId } = await params;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
        }

        await connectDB();

        const attendanceRecords = await Attendance.find({
            eventId: new mongoose.Types.ObjectId(eventId),
        })
            .sort({ markedAt: -1 })
            .lean();

        return NextResponse.json({
            attendance: attendanceRecords,
            total: attendanceRecords.length,
        });
    } catch (error) {
        console.error('Error fetching attendance:', error);
        return NextResponse.json(
            { error: 'Failed to fetch attendance' },
            { status: 500 }
        );
    }
}
