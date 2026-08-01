'use client';

import { use } from 'react';
import { LoadingFrame } from '@/components/dot-matrix';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BoxyFrame } from '@/components/boxy';
import { UserPoolManager } from '@/components/UserPoolManager';
import { BackToEvent } from '@/components/back-to-event';

interface EventDetailResponse {
    event: { _id: string; title: string; userPoolEnabled?: boolean };
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

export default function UserPoolPage({
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
    const enabled = data?.event.userPoolEnabled;

    return (
        <div className="space-y-6">
            <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Event</div>
                <div className="flex items-center justify-between gap-4">
                    <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">User Pool</h1>
                    <BackToEvent eventId={eventId} />
                </div>
                <p className="text-muted-foreground mt-1">
                    Who is inside right now, and everyone who has used the pool. Staff add and
                    remove people from the mobile app by scanning a ticket and tapping an ID card.
                </p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <LoadingFrame label="Loading" />
                </div>
            ) : error || !data ? (
                <p className="text-rose-300">Failed to load event.</p>
            ) : (
                <>
                    {/* Turning the feature off never deletes anything, so the
                        tables stay visible — read-only — to make that obvious. */}
                    {!enabled && (
                        <BoxyFrame className="bg-card/40 p-5">
                            <p className="text-foreground font-medium">User Pool is turned off for this event.</p>
                            <p className="text-muted-foreground text-sm mt-1">
                                Nothing below has been deleted. Turn &ldquo;User Pool&rdquo; back on to
                                resume adding and removing people from the mobile app.
                            </p>
                            <Link href={`/dashboard/events/${eventId}`} className="inline-block mt-4">
                                <span className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background hover:bg-foreground/90 text-sm font-medium transition-all">
                                    Go to event settings
                                </span>
                            </Link>
                        </BoxyFrame>
                    )}
                    <UserPoolManager eventId={eventId} canManage={canManage && !!enabled} />
                </>
            )}
        </div>
    );
}
