import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import UserPoolEntry from '@/lib/db/models/userPoolEntry';
import { getAuthUser, requireEventAccess, requireRole } from '@/lib/auth/middleware';

// POST /api/events/[eventId]/user-pool/remove
// Body: { entryId } — from the ticket lookup (mobile) or a table row (webapp).
//        { all: true } — empty the pool in one go (webapp only, admins only).
//
// Uniform for anyone with event access; the "manual remove is webapp-only"
// decision is a UI affordance, not a second permission axis — the mobile app
// simply never calls this without a preceding ticket scan.
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
        const { entryId, all } = body;

        // Emptying the pool is not a door action, so it is held to the dashboard's bar
        // rather than the scanner's — an app_user can remove the person in front of
        // them, not everyone at once.
        const removeAll = all === true;
        if (removeAll) {
            const roleCheck = requireRole(user, 'admin', 'event_admin');
            if (roleCheck) return roleCheck;
        } else if (!entryId || typeof entryId !== 'string' || !mongoose.Types.ObjectId.isValid(entryId)) {
            return NextResponse.json({ error: 'A valid entryId is required' }, { status: 400 });
        }

        await connectDB();

        const event = await Event.findById(eventId).select('_id userPoolEnabled').lean();
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }
        if (!event.userPoolEnabled) {
            return NextResponse.json(
                { error: 'User Pool is not enabled for this event' },
                { status: 400 }
            );
        }

        const eventObjectId = new mongoose.Types.ObjectId(eventId);

        if (removeAll) {
            // Same exitedAt:null guard as the single remove, applied to the whole event:
            // stays that already ended keep their original exit time, and the history
            // rows are left alone. Every one of these people can walk back in after.
            const exitedAt = new Date();
            const { modifiedCount } = await UserPoolEntry.updateMany(
                { eventId: eventObjectId, exitedAt: null },
                { $set: { exitedAt, removedBy: new mongoose.Types.ObjectId(user.userId) } }
            );

            return NextResponse.json({
                ok: true,
                removed: modifiedCount,
                currentCount: await UserPoolEntry.countDocuments({ eventId: eventObjectId, exitedAt: null }),
                message:
                    modifiedCount === 0
                        ? 'The pool was already empty'
                        : `Removed ${modifiedCount} ${modifiedCount === 1 ? 'person' : 'people'} from the pool`,
            });
        }

        // Atomic: the exitedAt:null guard makes a double-remove a no-op rather
        // than overwriting the original exit time.
        const entry = await UserPoolEntry.findOneAndUpdate(
            {
                _id: new mongoose.Types.ObjectId(entryId),
                eventId: eventObjectId,
                exitedAt: null,
            },
            {
                $set: {
                    exitedAt: new Date(),
                    removedBy: new mongoose.Types.ObjectId(user.userId),
                },
            },
            { new: true }
        );

        if (!entry) {
            return NextResponse.json(
                { error: 'This user is no longer in the pool', alreadyRemoved: true },
                { status: 409 }
            );
        }

        const durationMs =
            new Date(entry.exitedAt!).getTime() - new Date(entry.enteredAt).getTime();

        const currentCount = await UserPoolEntry.countDocuments({
            eventId: eventObjectId,
            exitedAt: null,
        });

        return NextResponse.json({
            ok: true,
            message: 'User removed from the pool',
            entry: {
                _id: entry._id,
                name: entry.name,
                regNo: entry.regNo,
                email: entry.email,
                phone: entry.phone,
                enteredAt: entry.enteredAt,
                exitedAt: entry.exitedAt,
                durationMs,
            },
            durationMs,
            currentCount,
        });
    } catch (error) {
        console.error('User pool remove error:', error);
        return NextResponse.json(
            { error: 'Failed to remove the user from the pool' },
            { status: 500 }
        );
    }
}
