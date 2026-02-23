import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import { getAuthUser, requireRole, requireEventAccess } from '@/lib/auth/middleware';

// PATCH /api/events/[eventId]/settings - Update event settings
export async function PATCH(
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

        // Admin and event_admin can modify settings
        const roleCheck = requireRole(user, 'admin', 'event_admin');
        if (roleCheck) return roleCheck;
        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        const body = await req.json();
        const { isPublicDownload, rotateTicket } = body;

        await connectDB();

        const event = await Event.findById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const updateFields: Record<string, any> = {};

        if (typeof isPublicDownload === 'boolean') {
            updateFields.isPublicDownload = isPublicDownload;
        }

        if (typeof rotateTicket === 'boolean') {
            updateFields['ticketTemplate.rotateTicket'] = rotateTicket;
        }

        if (Object.keys(updateFields).length > 0) {
            await Event.findByIdAndUpdate(eventId, updateFields);
        }

        return NextResponse.json({
            message: 'Settings updated successfully',
        });
    } catch (error) {
        console.error('Settings update error:', error);
        return NextResponse.json(
            { error: 'Failed to update settings' },
            { status: 500 }
        );
    }
}
