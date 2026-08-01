'use client';

import { use } from 'react';
import { LoadingFrame } from '@/components/dot-matrix';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BoxyFrame } from '@/components/boxy';
import { TicketTemplateEditor } from '@/components/TicketTemplateEditor';
import { BackToEvent } from '@/components/back-to-event';

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
            <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Event</div>
                <div className="flex items-center justify-between gap-4">
                    <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">Ticket Template</h1>
                    <BackToEvent eventId={eventId} />
                </div>
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
