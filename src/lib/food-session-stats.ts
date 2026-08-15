// Shared shape/helpers for food session capacity stats.
//
// `count` means *assigned* — a seat is consumed when an attendee is given a colour at
// the door, not when they eat.

import { describeFoodColor } from '@/lib/food-colors';

export interface FoodSessionStats {
    admitted: number;
    remainingToLimit: number;
    remainingToMax: number;
    nearLimit: boolean; // count has reached the soft limit
    full: boolean; // count has reached the hard max
}

export function computeFoodSessionStats(
    count: number,
    limit: number,
    maxLimit: number
): FoodSessionStats {
    return {
        admitted: count,
        remainingToLimit: Math.max(0, limit - count),
        remainingToMax: Math.max(0, maxLimit - count),
        nearLimit: count >= limit,
        full: count >= maxLimit,
    };
}

interface FoodSessionDoc {
    _id: unknown;
    eventId?: unknown;
    color: string;
    limit: number;
    maxLimit: number;
    isVisible?: boolean;
    count: number;
    createdAt?: Date;
}

/**
 * The one wire shape for a session. Colour name and hex are resolved here so clients —
 * the dashboard, the seat map, and the Android app — never carry their own palette.
 *
 * `served` is counted on demand rather than denormalized onto the session: it only drives
 * displays, never a capacity decision, so it does not need to be race-safe.
 */
export function serializeFoodSession(s: FoodSessionDoc, served = 0) {
    return {
        _id: s._id,
        eventId: s.eventId,
        color: s.color,
        ...describeFoodColor(s.color),
        limit: s.limit,
        maxLimit: s.maxLimit,
        isVisible: s.isVisible ?? true,
        count: s.count,
        served,
        createdAt: s.createdAt,
        stats: computeFoodSessionStats(s.count, s.limit, s.maxLimit),
    };
}
