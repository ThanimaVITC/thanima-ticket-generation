import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import EventRegistration from '@/lib/db/models/registration';
import { getAuthUser } from '@/lib/auth/middleware';

interface RegistrationRow {
    name: string;
    regNo: string;
    email: string;
    phone: string;
    source?: 'csv' | 'xls';
    status?: 'valid' | 'duplicate' | 'rejected';
    reason?: string;
}

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

        const event = await Event.findById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]; // Read first sheet
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (jsonData.length === 0) {
            return NextResponse.json({ error: 'File is empty' }, { status: 400 });
        }

        const validRegistrations: RegistrationRow[] = [];
        const rejectedRegistrations: RegistrationRow[] = [];
        const emailSet = new Set<string>();
        const regNoSet = new Set<string>();

        // Normalize headers logic
        // We look for specific headers. 
        // XLS Spec: Id, Name, Email, Ph_No, Payment Status
        // CSV Spec: name, regno, email, phone

        // Fetch existing registrations for duplicate check
        const existingRegs = await EventRegistration.find({ eventId }, { email: 1, regNo: 1 });
        const existingEmails = new Set(existingRegs.map(r => r.email.toLowerCase()));
        const existingRegNos = new Set(existingRegs.map(r => r.regNo));

        for (const row of jsonData as any[]) {
            let name = '';
            let regNo = '';
            let email = '';
            let phone = '';
            let paymentStatus = '';

            // Heuristic to detect format
            if ('Payment Status' in row || 'Id' in row) {
                // New XLS Format
                // Headers: Id, Name, Email, Ph_No, Payment Status
                name = row['Name']?.trim();
                regNo = row['Id']?.toString().trim();
                email = row['Email']?.trim().toLowerCase();
                phone = row['Ph_No']?.toString().trim();
                paymentStatus = row['Payment Status']?.toString().trim();

                if (paymentStatus.toLowerCase() !== 'paid') {
                    rejectedRegistrations.push({
                        name: name || 'Unknown',
                        regNo: regNo || 'Unknown',
                        email: email || 'Unknown',
                        phone: phone || '',
                        reason: `Payment Status is "${paymentStatus}" (required "Paid")`
                    });
                    continue;
                }
            } else {
                // Classic CSV Format or fallback
                // Headers: name, regno, email, phone
                // Look for common variations
                const keys = Object.keys(row);
                const findKey = (search: string[]) => keys.find(k => search.includes(k.toLowerCase().replace(/[^a-z]/g, '')));

                name = (row['name'] || row[findKey(['name']) || ''])?.trim();
                regNo = (row['regno'] || row['reg_no'] || row['regNo'] || row[findKey(['regno', 'reg_no']) || ''])?.toString().trim();
                email = (row['email'] || row[findKey(['email']) || ''])?.trim().toLowerCase();
                phone = (row['phone'] || row['mobile'] || row['ph_no'] || row[findKey(['phone', 'mobile']) || ''])?.toString().trim();

                // Classic format implies accepted status (or we ignore payment status check)
            }

            // Basic Validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!name || name.length < 2) {
                rejectedRegistrations.push({ name: name || 'N/A', regNo: regNo || 'N/A', email: email || 'N/A', phone, reason: 'Invalid or missing Name' });
                continue;
            }
            if (!regNo) {
                rejectedRegistrations.push({ name, regNo: 'N/A', email: email || 'N/A', phone, reason: 'Missing Registration Number' });
                continue;
            }
            if (!email || !emailRegex.test(email)) {
                rejectedRegistrations.push({ name, regNo, email: email || 'N/A', phone, reason: 'Invalid or missing Email' });
                continue;
            }

            // Duplicate Check (In File)
            if (emailSet.has(email)) {
                rejectedRegistrations.push({ name, regNo, email, phone, reason: 'Duplicate Email in file' });
                continue; // Skip duplicate in file
            }
            if (regNoSet.has(regNo)) {
                rejectedRegistrations.push({ name, regNo, email, phone, reason: 'Duplicate RegNo in file' });
                continue;
            }

            // Duplicate Check (In DB)
            let isDuplicate = false;
            let dupReason = '';

            if (existingEmails.has(email)) {
                isDuplicate = true;
                dupReason = 'Email already registered';
            } else if (existingRegNos.has(regNo)) {
                isDuplicate = true;
                dupReason = 'RegNo already registered';
            }

            if (isDuplicate) {
                rejectedRegistrations.push({
                    name, regNo, email, phone,
                    status: 'duplicate',
                    reason: dupReason
                });
            } else {
                validRegistrations.push({
                    name, regNo, email, phone,
                    status: 'valid'
                });
                emailSet.add(email);
                regNoSet.add(regNo);
            }
        }

        return NextResponse.json({
            valid: validRegistrations,
            rejected: rejectedRegistrations,
            stats: {
                total: jsonData.length,
                valid: validRegistrations.length,
                rejected: rejectedRegistrations.length
            }
        });

    } catch (error) {
        console.error('Preview error:', error);
        return NextResponse.json(
            { error: 'Failed to process file' },
            { status: 500 }
        );
    }
}
