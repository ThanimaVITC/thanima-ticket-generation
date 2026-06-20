'use client';

import { use } from 'react';
import { LoadingFrame } from '@/components/dot-matrix';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BoxyFrame } from '@/components/boxy';
import { FoodSessionsManager } from '@/components/FoodSessionsManager';

interface EventDetailResponse {
    event: { _id: string; title: string; foodSessionsEnabled?: boolean };
}

interface CurrentUser {
    role: 'admin' | 'event_admin' | 'app_user';
}

async function fetchEventDetail(eventId: string): Promise<EventDetailResponse> {
    const res = await fetch(`/api/events/${eventId}`);
    if (!res.ok) throw new Error('Failed to fetch event');
    return res.json();
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
}

export default function FoodSessionsPage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const { eventId } = use(params);

    const { data, isLoading, error } = useQuery({
        queryKey: ['event', eventId],
        queryFn: () => fetchEventDetail(eventId),
    });

    const { data: currentUser } = useQuery({
        queryKey: ['current-user'],
        queryFn: fetchCurrentUser,
    });

    const canManage = currentUser?.role === 'admin' || currentUser?.role === 'event_admin';
    const enabled = data?.event.foodSessionsEnabled;

    return (
        <div className="space-y-6">
            <Link href={`/dashboard/events/${eventId}`} className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors text-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Event
            </Link>

            <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Event</div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">Food Sessions</h1>
                <p className="text-muted-foreground mt-1">
                    Capacity-limited food hall sittings. Hidden sessions can&apos;t be scanned in the app.
                </p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <LoadingFrame label="Loading" />
                </div>
            ) : error || !data ? (
                <p className="text-rose-300">Failed to load event.</p>
            ) : !enabled ? (
                <BoxyFrame className="bg-card/40 p-8 text-center">
                    <p className="text-foreground font-medium">Food sessions are turned off for this event.</p>
                    <p className="text-muted-foreground text-sm mt-1">
                        Enable “Food Sessions” on the event page to start adding sittings.
                    </p>
                    <Link href={`/dashboard/events/${eventId}`} className="inline-block mt-4">
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background hover:bg-foreground/90 text-sm font-medium transition-all">
                            Go to event settings
                        </span>
                    </Link>
                </BoxyFrame>
            ) : (
                <FoodSessionsManager eventId={eventId} canManage={canManage} />
            )}
        </div>
    );
}
