import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import { getAuthUser, requireRole, requireEventAccess } from '@/lib/auth/middleware';
import { uploadObject, deleteObject, presignGet, isS3Key } from '@/lib/s3';

// Same private bucket as the ticket poster; the logo is read back through a
// presigned URL by the homepage and the mobile app.
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

/** Auth + validation shared by POST and DELETE. */
async function guard(eventId: string) {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    return requireRole(user, 'admin', 'event_admin') ?? requireEventAccess(user, eventId);
}

// POST /api/events/[eventId]/logo - Upload (or replace) the event logo
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const denied = await guard(eventId);
        if (denied) return denied;

        const file = (await req.formData()).get('file') as File | null;
        if (!file) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 });
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Allowed: PNG, JPG, WEBP' },
                { status: 400 }
            );
        }

        await connectDB();

        const event = await Event.findById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const ext = (file.name.split('.').pop() || 'png').toLowerCase();
        const key = `events/${eventId}/logo_${Date.now()}.${ext}`;
        await uploadObject(key, Buffer.from(await file.arrayBuffer()), file.type);

        // Best-effort removal of the previous logo object on replace.
        const previous = event.logoPath;
        if (isS3Key(previous) && previous !== key) {
            await deleteObject(previous).catch(() => {});
        }

        await Event.findByIdAndUpdate(eventId, { logoPath: key });

        return NextResponse.json({
            message: 'Logo uploaded successfully',
            logoPath: await presignGet(key),
        });
    } catch (error) {
        console.error('Logo upload error:', error);
        return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
    }
}

// DELETE /api/events/[eventId]/logo - Remove the event logo
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const denied = await guard(eventId);
        if (denied) return denied;

        await connectDB();

        const event = await Event.findById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        if (isS3Key(event.logoPath)) {
            await deleteObject(event.logoPath).catch(() => {});
        }

        await Event.findByIdAndUpdate(eventId, { $unset: { logoPath: '' } });

        return NextResponse.json({ message: 'Logo removed' });
    } catch (error) {
        console.error('Logo delete error:', error);
        return NextResponse.json({ error: 'Failed to remove logo' }, { status: 500 });
    }
}
