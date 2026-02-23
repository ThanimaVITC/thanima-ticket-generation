import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import { getAuthUser, requireRole } from '@/lib/auth/middleware';

// POST /api/events/[eventId]/set-active - Set this event as the active display event
export async function POST(
    req: NextRequest,
    props: { params: Promise<{ eventId: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const roleCheck = requireRole(user, 'admin');
        if (roleCheck) return roleCheck;

        const params = await props.params;
        const { eventId } = params;

        await connectDB();

        // First, set all events to inactive
        await Event.updateMany({}, { isActiveDisplay: false });

        // Then set this event as active
        const event = await Event.findByIdAndUpdate(
            eventId,
            { isActiveDisplay: true },
            { new: true }
        );

        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Revalidate homepage
        revalidatePath('/');

        return NextResponse.json({
            event,
            message: 'Event set as active display',
        });
    } catch (error) {
        console.error('Error setting active event:', error);
        return NextResponse.json(
            { error: 'Failed to set active event' },
            { status: 500 }
        );
    }
}

// DELETE /api/events/[eventId]/set-active - Remove active display from this event
export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ eventId: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const roleCheck = requireRole(user, 'admin');
        if (roleCheck) return roleCheck;

        const params = await props.params;
        const { eventId } = params;

        await connectDB();

        const event = await Event.findByIdAndUpdate(
            eventId,
            { isActiveDisplay: false },
            { new: true }
        );

        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Revalidate homepage
        revalidatePath('/');

        return NextResponse.json({
            event,
            message: 'Event removed from active display',
        });
    } catch (error) {
        console.error('Error removing active event:', error);
        return NextResponse.json(
            { error: 'Failed to remove active event' },
            { status: 500 }
        );
    }
}
