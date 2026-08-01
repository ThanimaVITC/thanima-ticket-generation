import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import UnpaidEntry from '@/lib/db/models/unpaidEntry';
import { getAuthUser, requireEventAccess } from '@/lib/auth/middleware';
import { normalizeName, normalizeRegNo } from '@/lib/unpaid';

// GET /api/events/[eventId]/unpaid — the list, newest first.
// Not gated on unpaidEnabled: turning the feature off must never hide records
// that already exist (same rule as the User Pool).
export async function GET(
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

        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        await connectDB();

        const event = await Event.findById(eventId).select('_id unpaidEnabled').lean();
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const entries = await UnpaidEntry.find({
            eventId: new mongoose.Types.ObjectId(eventId),
        })
            .sort({ createdAt: -1 })
            .lean();

        return NextResponse.json({
            unpaidEnabled: event.unpaidEnabled ?? false,
            entries: entries.map((e) => ({
                _id: e._id,
                name: e.name,
                regNo: e.regNo,
                source: e.source,
                createdAt: e.createdAt,
            })),
            stats: { total: entries.length },
        });
    } catch (error) {
        console.error('Error fetching unpaid list:', error);
        return NextResponse.json(
            { error: 'Failed to fetch the unpaid list' },
            { status: 500 }
        );
    }
}

// POST /api/events/[eventId]/unpaid — add one person.
// Body: { name, regNo, source? } — source is 'manual' or 'ocr'.
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

        const eventAccess = requireEventAccess(user, eventId);
        if (eventAccess) return eventAccess;

        const body = await req.json();

        let name: string;
        let regNo: string;
        try {
            name = normalizeName(body.name);
            regNo = normalizeRegNo(body.regNo);
        } catch (err) {
            return NextResponse.json(
                { error: err instanceof Error ? err.message : 'Invalid input' },
                { status: 400 }
            );
        }

        const source = body.source === 'ocr' ? 'ocr' : 'manual';

        await connectDB();

        const event = await Event.findById(eventId).select('_id unpaidEnabled').lean();
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }
        if (!event.unpaidEnabled) {
            return NextResponse.json(
                { error: 'The Unpaid list is not enabled for this event' },
                { status: 400 }
            );
        }

        const eventObjectId = new mongoose.Types.ObjectId(eventId);

        try {
            const entry = await UnpaidEntry.create({
                eventId: eventObjectId,
                name,
                regNo,
                source,
                addedBy: new mongoose.Types.ObjectId(user.userId),
            });

            const total = await UnpaidEntry.countDocuments({ eventId: eventObjectId });

            return NextResponse.json(
                {
                    ok: true,
                    message: 'Added to the unpaid list',
                    entry: {
                        _id: entry._id,
                        name: entry.name,
                        regNo: entry.regNo,
                        source: entry.source,
                        createdAt: entry.createdAt,
                    },
                    total,
                },
                { status: 201 }
            );
        } catch (err: unknown) {
            // Unique on (eventId, regNo) — re-scanning the same card is a no-op
            // rather than a duplicate line.
            if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
                const existing = await UnpaidEntry.findOne({
                    eventId: eventObjectId,
                    regNo,
                }).lean();
                return NextResponse.json(
                    {
                        error: 'This registration number is already on the unpaid list',
                        alreadyListed: true,
                        entry: existing
                            ? {
                                  _id: existing._id,
                                  name: existing.name,
                                  regNo: existing.regNo,
                                  createdAt: existing.createdAt,
                              }
                            : null,
                    },
                    { status: 409 }
                );
            }
            throw err;
        }
    } catch (error) {
        console.error('Error adding to unpaid list:', error);
        return NextResponse.json(
            { error: 'Failed to add to the unpaid list' },
            { status: 500 }
        );
    }
}
