'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { LoadingFrame } from '@/components/dot-matrix';
import { BoxyFrame } from '@/components/boxy';
import { FoodEmailManager } from '@/components/FoodEmailManager';

interface EventDetailResponse {
    event: { _id: string; title: string; foodSessionsEnabled?: boolean };
}

async function fetchEventDetail(eventId: string): Promise<EventDetailResponse> {
    const res = await fetch(`/api/events/${eventId}`);
    if (!res.ok) throw new Error('Failed to fetch event');
    return res.json();
}

export default function FoodEmailsPage({ params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = use(params);

    const { data, isLoading, error } = useQuery({
        queryKey: ['event', eventId],
        queryFn: () => fetchEventDetail(eventId),
    });

    return (
        <div className="space-y-6">
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <LoadingFrame label="Loading" />
                </div>
            ) : error || !data ? (
                <p className="text-rose-300">Failed to load event.</p>
            ) : !data.event.foodSessionsEnabled ? (
                <BoxyFrame className="bg-card/40 p-8 text-center">
                    <p className="text-foreground font-medium">Food sessions are turned off for this event.</p>
                    <p className="text-muted-foreground text-sm mt-1">
                        There is nothing to mail until food sessions are enabled and colours are assigned.
                    </p>
                    <Link href={`/dashboard/events/${eventId}`} className="inline-block mt-4">
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background hover:bg-foreground/90 text-sm font-medium transition-all">
                            Go to event settings
                        </span>
                    </Link>
                </BoxyFrame>
            ) : (
                <FoodEmailManager eventId={eventId} eventTitle={data.event.title} />
            )}
        </div>
    );
}
