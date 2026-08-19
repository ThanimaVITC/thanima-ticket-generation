'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingFrame } from '@/components/dot-matrix';

// The slots board: a public, no-login screen for the hall. Big colours, seats left, and
// the sitting time — nothing about who holds a slot.

interface PublicSlot {
    _id: string;
    colorName: string;
    colorHex: string;
    timing: string;
    remaining: number;
    full: boolean;
}

interface PublicSlotsResponse {
    eventTitle: string;
    foodSessionsEnabled: boolean;
    sessions: PublicSlot[];
}

async function fetchSlots(eventId: string): Promise<PublicSlotsResponse> {
    const res = await fetch(`/api/public/food-slots/${eventId}`);
    if (!res.ok) throw new Error('Failed to load food slots');
    return res.json();
}

export default function FoodSlotsPage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const { eventId } = use(params);

    const { data, isLoading, error } = useQuery({
        queryKey: ['public-food-slots', eventId],
        queryFn: () => fetchSlots(eventId),
        refetchInterval: 5000,
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <LoadingFrame label="Loading slots" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <p className="text-rose-300 text-sm">Failed to load food slots.</p>
            </div>
        );
    }

    const sessions = data.sessions;

    return (
        <div className="min-h-screen bg-background flex flex-col p-5 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground truncate">
                        {data.eventTitle}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Food slots available</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground" />
                    </span>
                    Updates every 5 seconds
                </span>
            </div>

            {!data.foodSessionsEnabled || sessions.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">No food slots are open right now.</p>
                </div>
            ) : (
                /* Two per row, rows sharing the height evenly so the board fills the screen.
                   An odd last card takes the whole row rather than leaving a hole beside it. */
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 auto-rows-fr gap-4 sm:gap-5">
                    {sessions.map((s, i) => (
                        <div
                            key={s._id}
                            className={`border p-6 flex flex-col gap-3 h-full transition-opacity ${
                                s.full ? 'opacity-60' : ''
                            } ${i === sessions.length - 1 && sessions.length % 2 === 1 ? 'sm:col-span-2' : ''}`}
                            style={{ borderColor: s.colorHex, backgroundColor: `${s.colorHex}14` }}
                        >
                            <div className="flex items-center gap-3">
                                <span
                                    className="inline-block w-8 h-8 rounded-full shrink-0 ring-1 ring-white/20"
                                    style={{ backgroundColor: s.colorHex }}
                                />
                                <span className="text-2xl sm:text-3xl font-semibold text-foreground truncate">
                                    {s.colorName}
                                </span>
                            </div>

                            {/* The count owns the middle of the card — it is what people read
                                from across the hall. */}
                            <div className="flex-1 flex items-center">
                                {s.full ? (
                                    <span
                                        className="text-6xl sm:text-7xl xl:text-8xl font-bold tracking-wide leading-none"
                                        style={{ color: s.colorHex }}
                                    >
                                        SLOT FULL
                                    </span>
                                ) : (
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-8xl sm:text-9xl font-bold text-foreground tabular-nums leading-none xl:text-[11rem]">
                                            {s.remaining}
                                        </span>
                                        <span className="text-lg sm:text-xl text-muted-foreground">slots left</span>
                                    </div>
                                )}
                            </div>

                            <div className="border-t pt-3" style={{ borderColor: `${s.colorHex}40` }}>
                                <p className="text-lg text-foreground tabular-nums">
                                    {s.timing || 'Timing to be announced'}
                                </p>
                                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
                                    Tentative timing
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <p className="text-xs text-muted-foreground text-center mt-6">
                All timings shown are tentative and may change.
            </p>
        </div>
    );
}
