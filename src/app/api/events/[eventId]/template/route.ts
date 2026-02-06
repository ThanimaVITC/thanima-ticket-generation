import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import { getAuthUser } from '@/lib/auth/middleware';

// POST /api/events/[eventId]/template - Upload template image
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

        // Create uploads directory if needed
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadsDir, { recursive: true });

        // Generate unique filename
        const ext = file.name.split('.').pop() || 'png';
        const filename = `template_${eventId}_${Date.now()}.${ext}`;
        const filepath = path.join(uploadsDir, filename);

        // Save file
        const bytes = await file.arrayBuffer();
        await writeFile(filepath, Buffer.from(bytes));

        // Update event with template path
        const imagePath = `/uploads/${filename}`;
        await Event.findByIdAndUpdate(eventId, {
            'ticketTemplate.imagePath': imagePath,
        });

        return NextResponse.json({
            message: 'Template uploaded successfully',
            imagePath,
        });
    } catch (error) {
        console.error('Template upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload template' },
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
