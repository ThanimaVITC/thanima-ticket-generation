'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingFrame } from '@/components/dot-matrix';

interface FoodSession {
    _id: string;
    name: string;
    limit: number;
    maxLimit: number;
    count: number;
    stats: {
        admitted: number;
        remainingToLimit: number;
        remainingToMax: number;
        nearLimit: boolean;
        full: boolean;
    };
}

interface FoodSessionsResponse {
    foodSessionsEnabled: boolean;
    sessions: FoodSession[];
}

async function fetchSessions(eventId: string): Promise<FoodSessionsResponse> {
    const res = await fetch(`/api/events/${eventId}/food-sessions`);
    if (!res.ok) throw new Error('Failed to load food sessions');
    return res.json();
}

export default function FoodMapPage({
    params,
}: {
    params: Promise<{ eventId: string; sessionId: string }>;
}) {
    const { eventId, sessionId } = use(params);

    // Poll in the background so seats fill live as people are scanned in.
    const { data, isLoading, error } = useQuery({
        queryKey: ['food-sessions', eventId],
        queryFn: () => fetchSessions(eventId),
        refetchInterval: 2500,
    });

    const session = data?.sessions.find((s) => s._id === sessionId) ?? null;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <LoadingFrame label="Loading map" />
            </div>
        );
    }

    if (error || !data || !session) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <p className="text-rose-300 text-sm">
                    {error || !data ? 'Failed to load the session map.' : 'Session not found.'}
                </p>
            </div>
        );
    }

    // Show soft-limit squares until it's reached; then expand to the hard max.
    const soft = session.limit > 0 ? session.limit : session.maxLimit;
    const softReached = session.count >= soft;
    const total = Math.max(softReached ? session.maxLimit : soft, 1);
    const filled = Math.min(session.count, total);
    const cols = Math.max(1, Math.ceil(Math.sqrt(total * 1.7)));
    const gapClass = total > 400 ? 'gap-[2px]' : total > 150 ? 'gap-1' : 'gap-1.5';

    return (
        <div className="min-h-screen bg-background flex flex-col p-5 sm:p-8">
            {/* Slim header — the map only, no app chrome */}
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
                <div className="flex items-center gap-2 min-w-0">
                    <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground truncate">{session.name}</h1>
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300 shrink-0">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                        </span>
                        Live
                    </span>
                </div>
                <div className="text-right tabular-nums">
                    <span className="text-2xl sm:text-3xl font-bold text-foreground">{filled}/{total}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                        {session.stats.remainingToMax} to max ({session.maxLimit})
                        {softReached && <span className="text-orange-300"> · soft limit reached</span>}
                    </span>
                </div>
            </div>

            {/* Seat grid — capped square size so few seats stay tidy, many shrink to fit */}
            <div className="flex-1 flex items-start justify-center overflow-auto thin-scroll">
                <div
                    className={`grid justify-center ${gapClass}`}
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0.5rem, 2.75rem))` }}
                >
                    {Array.from({ length: total }).map((_, i) => (
                        <div
                            key={i}
                            className={`aspect-square transition-colors duration-500 ${i < filled ? 'bg-emerald-500' : 'bg-muted'}`}
                            title={`Seat ${i + 1}${i < filled ? ' · filled' : ' · open'}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
