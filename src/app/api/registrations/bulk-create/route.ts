import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db/connection';
import EventRegistration from '@/lib/db/models/registration';
import { getAuthUser } from '@/lib/auth/middleware';

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { eventId, registrations } = body;

        if (!eventId || !registrations || !Array.isArray(registrations)) {
            return NextResponse.json(
                { error: 'Invalid payload' },
                { status: 400 }
            );
        }

        if (registrations.length === 0) {
            return NextResponse.json({ message: 'No registrations to insert', count: 0 });
        }

        await connectDB();

        // Generate hashes
        const registrationsWithHashes = await Promise.all(
            registrations.map(async (reg: any) => {
                const qrInput = `${reg.email}:${reg.phone}`;
                const qrPayload = await bcrypt.hash(qrInput, 10);
                return {
                    eventId: new mongoose.Types.ObjectId(eventId),
                    name: reg.name,
                    regNo: reg.regNo,
                    email: reg.email,
                    phone: reg.phone,
                    qrPayload,
                    source: 'bulk_upload',
                    createdAt: new Date(),
                    attended: false
                };
            })
        );

        // Bulk insert
        // using ordered: false to skip duplicates if they slipped through
        let insertedCount = 0;
        let errors: any[] = [];

        try {
            const result = await EventRegistration.insertMany(registrationsWithHashes, {
                ordered: false
            });
            insertedCount = result.length;
        } catch (error: any) {
            if (error.code === 11000) {
                // Some duplicates
                insertedCount = error.insertedDocs?.length || 0;
                // We don't really need to report exact duplicate details here since we filtered in preview,
                // but good to log or return.
            } else {
                throw error;
            }
        }

        return NextResponse.json({
            message: 'Registrations created successfully',
            count: insertedCount
        });

    } catch (error) {
        console.error('Bulk create error:', error);
        return NextResponse.json(
            { error: 'Failed to create registrations' },
            { status: 500 }
        );
    }
}
