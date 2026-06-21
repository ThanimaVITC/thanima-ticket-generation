import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import { getAuthUser, requireRole, requireEventAccess } from '@/lib/auth/middleware';
import { uploadObject, deleteObject, presignGet, isS3Key } from '@/lib/s3';

// POST /api/events/[eventId]/template - Upload the ticket poster to S3
export async function POST(
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

        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
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

        // Upload the poster to S3 under a private, per-event key.
        const ext = (file.name.split('.').pop() || 'png').toLowerCase();
        const key = `events/${eventId}/template_${Date.now()}.${ext}`;
        const bytes = Buffer.from(await file.arrayBuffer());
        await uploadObject(key, bytes, file.type);

        // Best-effort removal of the previous poster object on replace.
        const previous = event.ticketTemplate?.imagePath;
        if (isS3Key(previous) && previous !== key) {
            await deleteObject(previous).catch(() => {});
        }

        // Store the S3 key; the browser reads it via a presigned URL.
        await Event.findByIdAndUpdate(eventId, {
            'ticketTemplate.imagePath': key,
        });

        const imagePath = await presignGet(key);

        return NextResponse.json({
            message: 'Template uploaded successfully',
            imagePath,
            type: 'template',
        });
    } catch (error) {
        console.error('Template upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        );
    }
}

// PATCH /api/events/[eventId]/template - Update template positions
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

        const body = await req.json();
        const { qrPosition, namePosition, regNoPosition } = body;

        await connectDB();

        const event = await Event.findById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const updateData: Record<string, unknown> = {};

        if (qrPosition) {
            updateData['ticketTemplate.qrPosition'] = qrPosition;
        }
        if (namePosition) {
            updateData['ticketTemplate.namePosition'] = namePosition;
        }
        if (regNoPosition) {
            updateData['ticketTemplate.regNoPosition'] = regNoPosition;
        }

        await Event.findByIdAndUpdate(eventId, updateData);

        return NextResponse.json({
            message: 'Template settings updated successfully',
        });
    } catch (error) {
        console.error('Template update error:', error);
        return NextResponse.json(
            { error: 'Failed to update template settings' },
            { status: 500 }
        );
    }
}

// DELETE /api/events/[eventId]/template - Remove the current poster.
export async function DELETE(
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

        const roleCheck = requireRole(user, 'admin', 'event_admin');
        if (roleCheck) return roleCheck;
        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        await connectDB();

        const event = await Event.findById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Best-effort remove the object from S3 (ignore if already gone or legacy).
        const currentPath = event.ticketTemplate?.imagePath;
        if (isS3Key(currentPath)) {
            await deleteObject(currentPath).catch(() => {});
        }

        await Event.findByIdAndUpdate(eventId, { $unset: { 'ticketTemplate.imagePath': '' } });

        return NextResponse.json({
            message: 'Poster removed',
            type: 'template',
        });
    } catch (error) {
        console.error('Template delete error:', error);
        return NextResponse.json(
            { error: 'Failed to remove image' },
            { status: 500 }
        );
    }
}
