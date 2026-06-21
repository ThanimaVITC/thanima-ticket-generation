'use client';

import { use } from 'react';
import { LoadingFrame } from '@/components/dot-matrix';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { BoxyFrame } from '@/components/boxy';
import { TicketTemplateEditor } from '@/components/TicketTemplateEditor';

interface TicketTemplate {
    imagePath?: string;
    qrPosition?: { x: number; y: number; width: number; height: number };
    namePosition?: { x: number; y: number; fontSize: number; color: string; fontFamily?: string };
    regNoPosition?: { x: number; y: number; fontSize: number; color: string; fontFamily?: string };
}

interface EventDetailResponse {
    event: { _id: string; title: string; ticketTemplate?: TicketTemplate };
}

async function fetchEventDetail(eventId: string): Promise<EventDetailResponse> {
    const res = await fetch(`/api/events/${eventId}`);
    if (!res.ok) throw new Error('Failed to fetch event');
    return res.json();
}

export default function TemplatePage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const { eventId } = use(params);
    const queryClient = useQueryClient();

    const { data, isLoading, error } = useQuery({
        queryKey: ['event', eventId],
        queryFn: () => fetchEventDetail(eventId),
    });

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
                <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">Ticket Template</h1>
                <p className="text-muted-foreground mt-1">
                    Upload the poster, then drag the QR and text to position them. Changes apply to every generated ticket.
                </p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <LoadingFrame label="Loading template" />
                </div>
            ) : error || !data ? (
                <p className="text-rose-300">Failed to load template.</p>
            ) : (
                <BoxyFrame className="bg-card/40 p-5">
                    <TicketTemplateEditor
                        eventId={eventId}
                        template={data.event.ticketTemplate}
                        onSave={() => queryClient.invalidateQueries({ queryKey: ['event', eventId] })}
                    />
                </BoxyFrame>
            )}
        </div>
    );
}
