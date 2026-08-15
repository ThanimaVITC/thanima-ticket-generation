import mongoose from 'mongoose';
import FoodSession from '@/lib/db/models/foodSession';
import FoodAssignment from '@/lib/db/models/foodAssignment';
import { serializeFoodSession } from '@/lib/food-session-stats';
import { describeFoodColor } from '@/lib/food-colors';

/**
 * Take a seat in a session, but only if it is visible and below its hard cap. Returns
 * the updated session, or null when it is full or hidden. This is the single point where
 * capacity is consumed — the food counter reserves nothing.
 */
export async function reserveSeat(sessionId: string, eventId: string) {
    return FoodSession.findOneAndUpdate(
        {
            _id: new mongoose.Types.ObjectId(sessionId),
            eventId: new mongoose.Types.ObjectId(eventId),
            isVisible: true,
            $expr: { $lt: ['$count', '$maxLimit'] },
        },
        { $inc: { count: 1 } },
        { new: true }
    );
}

/** Give a seat back after a failed assignment or a move to another colour. */
export async function releaseSeat(sessionId: mongoose.Types.ObjectId | string) {
    await FoodSession.findByIdAndUpdate(sessionId, { $inc: { count: -1 } });
}

export function describeAssignment(
    assignment: { foodSessionId: mongoose.Types.ObjectId } | null,
    session: { _id: unknown; color: string } | null
) {
    if (!assignment || !session) return null;
    return {
        sessionId: session._id,
        color: session.color,
        ...describeFoodColor(session.color),
    };
}

/**
 * Everything the mobile app needs to open the slot picker, returned inline with the
 * attendance response so marking someone present costs one round trip rather than three.
 * Counts come back fresh on every scan, which is what keeps the circles live.
 */
export async function buildFoodBlock(
    eventId: mongoose.Types.ObjectId | string,
    email: string,
    foodSessionsEnabled: boolean | undefined
) {
    if (!foodSessionsEnabled) return { enabled: false, assignment: null, sessions: [] };

    const oid = new mongoose.Types.ObjectId(eventId.toString());

    const [sessions, assignment] = await Promise.all([
        FoodSession.find({ eventId: oid, isVisible: true }).sort({ createdAt: 1 }).lean(),
        FoodAssignment.findOne({ eventId: oid, email }).lean(),
    ]);

    const assignedSession = assignment
        ? sessions.find((s) => s._id.toString() === assignment.foodSessionId.toString()) ??
          (await FoodSession.findById(assignment.foodSessionId).select('color').lean())
        : null;

    return {
        enabled: true,
        assignment: describeAssignment(assignment, assignedSession ?? null),
        sessions: sessions.map(serializeFoodSession),
    };
}
