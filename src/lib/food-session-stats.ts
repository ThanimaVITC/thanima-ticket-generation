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
    startTime?: string;
    endTime?: string;
    createdAt?: Date;
}

/** "HH:MM" 24h from <input type="time"> to "1:00 PM". Empty in, empty out. */
export function formatSessionTime(hhmm?: string): string {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    if (!Number.isInteger(h) || !Number.isInteger(m)) return '';
    const period = h < 12 ? 'AM' : 'PM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * The sitting's time as one human string, or '' when nothing was entered.
 * A start alone is fine ("from 1:00 PM"); an end alone is treated as no timing,
 * since "until 2:00 PM" without a start tells an attendee nothing useful.
 */
export function describeSessionTiming(startTime?: string, endTime?: string): string {
    const start = formatSessionTime(startTime);
    if (!start) return '';
    const end = formatSessionTime(endTime);
    return end ? `${start} – ${end}` : start;
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
        startTime: s.startTime ?? '',
        endTime: s.endTime ?? '',
        timing: describeSessionTiming(s.startTime, s.endTime),
        served,
        createdAt: s.createdAt,
        stats: computeFoodSessionStats(s.count, s.limit, s.maxLimit),
    };
}
