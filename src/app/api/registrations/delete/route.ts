import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import EventRegistration from '@/lib/db/models/registration';
import Attendance from '@/lib/db/models/attendance';
import { getAuthUser } from '@/lib/auth/middleware';

// DELETE /api/registrations/delete - Delete registrations (single or bulk)
export async function DELETE(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { registrationIds, eventId } = body;

        if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: 'Valid eventId is required' }, { status: 400 });
        }

        if (!registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0) {
            return NextResponse.json(
                { error: 'registrationIds must be a non-empty array' },
                { status: 400 }
            );
        }

        // Validate all IDs
        const invalidIds = registrationIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            return NextResponse.json(
                { error: 'Invalid registration IDs provided' },
                { status: 400 }
            );
        }

        await connectDB();

        // Get the registrations to find their emails (for deleting attendance records)
        const registrations = await EventRegistration.find({
            _id: { $in: registrationIds.map(id => new mongoose.Types.ObjectId(id)) },
            eventId: new mongoose.Types.ObjectId(eventId),
        }).lean();

        if (registrations.length === 0) {
            return NextResponse.json(
                { error: 'No matching registrations found' },
                { status: 404 }
            );
        }

        const emails = registrations.map(reg => reg.email);

        // Delete registrations and their attendance records
        const [deleteResult] = await Promise.all([
            EventRegistration.deleteMany({
                _id: { $in: registrationIds.map(id => new mongoose.Types.ObjectId(id)) },
                eventId: new mongoose.Types.ObjectId(eventId),
            }),
            Attendance.deleteMany({
                eventId: new mongoose.Types.ObjectId(eventId),
                email: { $in: emails },
            }),
        ]);

        return NextResponse.json({
            message: 'Registrations deleted successfully',
            deletedCount: deleteResult.deletedCount,
        });
    } catch (error) {
        console.error('Delete registration error:', error);
        return NextResponse.json(
            { error: 'Failed to delete registrations' },
            { status: 500 }
        );
    }
}
