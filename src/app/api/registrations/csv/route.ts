import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Papa from 'papaparse';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import { getAuthUser } from '@/lib/auth/middleware';

interface CsvRow {
    name?: string;
    regno?: string;
    reg_no?: string;
    regNo?: string;
    email?: string;
}

// POST /api/registrations/csv - Bulk upload registrations via CSV
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const eventId = formData.get('eventId') as string | null;

        if (!file || !eventId) {
            return NextResponse.json(
                { error: 'File and eventId are required' },
                { status: 400 }
            );
        }

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
        }

        await connectDB();

        // Verify event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Parse CSV
        const csvText = await file.text();
        const { data, errors } = Papa.parse<CsvRow>(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.toLowerCase().trim().replace(/\s+/g, '_'),
        });

        if (errors.length > 0) {
            return NextResponse.json(
                { error: 'CSV parsing errors', details: errors },
                { status: 400 }
            );
        }

        // Check required columns exist
        if (data.length === 0) {
            return NextResponse.json(
                { error: 'CSV is empty' },
                { status: 400 }
            );
        }

        const firstRow = data[0];
        const hasName = 'name' in firstRow;
        const hasRegNo = 'regno' in firstRow || 'reg_no' in firstRow || 'regNo' in firstRow;
        const hasEmail = 'email' in firstRow;

        if (!hasName || !hasRegNo || !hasEmail) {
            const missing = [];
            if (!hasName) missing.push('name');
            if (!hasRegNo) missing.push('regno (or reg_no)');
            if (!hasEmail) missing.push('email');
            return NextResponse.json(
                { error: `CSV must have columns: ${missing.join(', ')}` },
                { status: 400 }
            );
        }

        // Extract and validate data
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const validRegistrations: { name: string; regNo: string; email: string }[] = [];
        const invalidRows: { row: number; reason: string }[] = [];

        data.forEach((row, index) => {
            const name = row.name?.trim();
            const regNo = (row.regno || row.reg_no || row.regNo)?.trim();
            const email = row.email?.trim().toLowerCase();

            const rowNum = index + 2; // +2 for header row and 0-index

            if (!name || name.length < 2) {
                invalidRows.push({ row: rowNum, reason: 'Missing or invalid name' });
            } else if (!regNo) {
                invalidRows.push({ row: rowNum, reason: 'Missing registration number' });
            } else if (!email) {
                invalidRows.push({ row: rowNum, reason: 'Missing email' });
            } else if (!emailRegex.test(email)) {
                invalidRows.push({ row: rowNum, reason: `Invalid email: ${email}` });
            } else {
                validRegistrations.push({ name, regNo, email });
            }
        });

        if (validRegistrations.length === 0) {
            return NextResponse.json(
                { error: 'No valid registrations found in CSV', invalidRows },
                { status: 400 }
            );
        }

        // Bulk insert with ordered: false to continue on duplicates
        const registrations = validRegistrations.map((reg) => ({
            eventId: new mongoose.Types.ObjectId(eventId),
            name: reg.name,
            regNo: reg.regNo,
            email: reg.email,
        }));

        let insertedCount = 0;
        let duplicateCount = 0;

        try {
            const result = await EventRegistration.insertMany(registrations, {
                ordered: false,
            });
            insertedCount = result.length;
        } catch (error: unknown) {
            // Handle duplicate key errors
            if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
                const bulkError = error as { insertedDocs?: unknown[]; writeErrors?: unknown[] };
                insertedCount = bulkError.insertedDocs?.length || 0;
                duplicateCount = bulkError.writeErrors?.length || 0;
            } else {
                throw error;
            }
        }

        return NextResponse.json({
            message: 'CSV processed successfully',
            stats: {
                totalRows: data.length,
                validRegistrations: validRegistrations.length,
                inserted: insertedCount,
                duplicates: duplicateCount,
                invalidRows: invalidRows.length,
            },
            invalidRows: invalidRows.slice(0, 10), // Return first 10 invalid rows
        });
    } catch (error) {
        console.error('CSV upload error:', error);
        return NextResponse.json(
            { error: 'Failed to process CSV' },
            { status: 500 }
        );
    }
}
