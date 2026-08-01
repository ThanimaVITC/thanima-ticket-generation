'use client';

import { use } from 'react';
import { LoadingFrame } from '@/components/dot-matrix';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BoxyFrame } from '@/components/boxy';
import { UnpaidManager } from '@/components/UnpaidManager';

interface EventDetailResponse {
    event: { _id: string; title: string; unpaidEnabled?: boolean };
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

export default function UnpaidPage({
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
    const enabled = !!data?.event.unpaidEnabled;

    return (
        <div className="space-y-6">
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <LoadingFrame label="Loading" />
                </div>
            ) : error || !data ? (
                <p className="text-rose-300">Failed to load event.</p>
            ) : (
                <>
                    {/* Turning the feature off hides the card in the app and blocks new
                        entries, but never deletes what is already recorded. */}
                    {!enabled && (
                        <BoxyFrame className="bg-card/40 p-5">
                            <p className="text-foreground font-medium">The Unpaid list is turned off for this event.</p>
                            <p className="text-muted-foreground text-sm mt-1">
                                Nothing below has been deleted. The card is hidden in the mobile app
                                and no new entries can be added until you turn it back on.
                            </p>
                            <Link href={`/dashboard/events/${eventId}`} className="inline-block mt-4">
                                <span className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background hover:bg-foreground/90 text-sm font-medium transition-all">
                                    Go to event settings
                                </span>
                            </Link>
                        </BoxyFrame>
                    )}
                    <UnpaidManager
                        eventId={eventId}
                        canManage={canManage}
                        enabled={enabled}
                        eventTitle={data.event.title}
                    />
                </>
            )}
        </div>
    );
}
