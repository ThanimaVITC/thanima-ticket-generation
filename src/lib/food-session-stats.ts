// Shared shape/helpers for food session capacity stats.

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
