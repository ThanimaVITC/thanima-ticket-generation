// Helpers shared by every User Pool route.

/**
 * Human-readable stay length: "2h 14m", "43m", "58s".
 */
export function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return '—';

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}
