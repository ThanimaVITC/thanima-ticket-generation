import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import EventRegistration from '@/lib/db/models/registration';
import Attendance from '@/lib/db/models/attendance';
import { getAuthUser } from '@/lib/auth/middleware';

// GET /api/registrations/[eventId] - List registrations for event
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

    const registrations = await EventRegistration.find({
      eventId: new mongoose.Types.ObjectId(eventId),
    })
      .sort({ createdAt: -1 })
      .lean();

    // Get attendance records
    const attendanceRecords = await Attendance.find({
      eventId: new mongoose.Types.ObjectId(eventId),
    }).lean();

    const attendanceMap = new Map(
      attendanceRecords.map((a) => [a.email, { markedAt: a.markedAt, source: a.source }])
    );

    const registrationsWithAttendance = registrations.map((reg) => ({
      ...reg,
      attended: attendanceMap.has(reg.email),
      attendance: attendanceMap.get(reg.email) || null,
    }));

    return NextResponse.json({
      registrations: registrationsWithAttendance,
      total: registrations.length,
    });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registrations' },
      { status: 500 }
    );
  }
}
