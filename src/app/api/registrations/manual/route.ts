import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import { getAuthUser } from '@/lib/auth/middleware';

// POST /api/registrations/manual - Add single registration
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { eventId, name, regNo, email } = body;

        if (!eventId || !name || !regNo || !email) {
            return NextResponse.json(
                { error: 'eventId, name, regNo, and email are required' },
                { status: 400 }
            );
        }

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const normalizedEmail = email.trim().toLowerCase();
        const trimmedName = name.trim();
        const trimmedRegNo = regNo.trim();

        if (!emailRegex.test(normalizedEmail)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        if (trimmedName.length < 2) {
            return NextResponse.json(
                { error: 'Name must be at least 2 characters' },
                { status: 400 }
            );
        }

        if (trimmedRegNo.length < 1) {
            return NextResponse.json(
                { error: 'Registration number is required' },
                { status: 400 }
            );
        }

        await connectDB();

        // Verify event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Check for existing registration by email
        const existingByEmail = await EventRegistration.findOne({
            eventId: new mongoose.Types.ObjectId(eventId),
            email: normalizedEmail,
        });

        if (existingByEmail) {
            return NextResponse.json(
                { error: 'Email already registered for this event' },
                { status: 409 }
            );
        }

        // Check for existing registration by regNo
        const existingByRegNo = await EventRegistration.findOne({
            eventId: new mongoose.Types.ObjectId(eventId),
            regNo: trimmedRegNo,
        });

        if (existingByRegNo) {
            return NextResponse.json(
                { error: 'Registration number already registered for this event' },
                { status: 409 }
            );
        }

        const registration = await EventRegistration.create({
            eventId: new mongoose.Types.ObjectId(eventId),
            name: trimmedName,
            regNo: trimmedRegNo,
            email: normalizedEmail,
        });

        return NextResponse.json(
            { registration, message: 'Registration added successfully' },
            { status: 201 }
        );
    } catch (error) {
        console.error('Manual registration error:', error);
        return NextResponse.json(
            { error: 'Failed to add registration' },
            { status: 500 }
        );
    }
}
