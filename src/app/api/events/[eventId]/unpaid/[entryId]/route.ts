import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import UnpaidEntry from '@/lib/db/models/unpaidEntry';
import { getAuthUser, requireRole, requireEventAccess } from '@/lib/auth/middleware';

// DELETE /api/events/[eventId]/unpaid/[entryId]
// The escape hatch for a typo or a bad OCR read. admin/event_admin only —
// this is a money list, so app_user can add but not erase.
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ eventId: string; entryId: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { eventId, entryId } = await params;

        if (
            !mongoose.Types.ObjectId.isValid(eventId) ||
            !mongoose.Types.ObjectId.isValid(entryId)
        ) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const roleCheck = requireRole(user, 'admin', 'event_admin');
        if (roleCheck) return roleCheck;
        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        await connectDB();

        const entry = await UnpaidEntry.findOneAndDelete({
            _id: new mongoose.Types.ObjectId(entryId),
            eventId: new mongoose.Types.ObjectId(eventId),
        });

        if (!entry) {
            return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        }

        return NextResponse.json({
            ok: true,
            message: 'Removed from the unpaid list',
        });
    } catch (error) {
        console.error('Error deleting unpaid entry:', error);
        return NextResponse.json(
            { error: 'Failed to remove the entry' },
            { status: 500 }
        );
    }
}
