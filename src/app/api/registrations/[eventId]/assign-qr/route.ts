import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import EventRegistration from '@/lib/db/models/registration';
import { getAuthUser } from '@/lib/auth/middleware';

// PUT /api/registrations/[eventId]/assign-qr - Assign QR payload to a registration
export async function PUT(
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
    const { registrationId, qrPayload } = body;

    if (!registrationId || !qrPayload) {
      return NextResponse.json(
        { error: 'registrationId and qrPayload are required' },
        { status: 400 }
      );
    }

    await connectDB();

    const registration = await EventRegistration.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(registrationId),
        eventId: new mongoose.Types.ObjectId(eventId),
      },
      { qrPayload },
      { new: true }
    );

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'QR payload assigned successfully',
      registration: {
        _id: registration._id,
        name: registration.name,
        regNo: registration.regNo,
        email: registration.email,
        qrPayloadAssigned: !!registration.qrPayload,
      },
    });
  } catch (error) {
    console.error('Error assigning QR payload:', error);
    return NextResponse.json(
      { error: 'Failed to assign QR payload' },
      { status: 500 }
    );
  }
}
