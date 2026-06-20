'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { BoxyFrame } from '@/components/boxy';
import { LoadingFrame } from '@/components/dot-matrix';

interface PublicEvent {
    _id: string;
    title: string;
    date: string;
    description?: string;
    isPublicDownload?: boolean;
}

export function PublicEventsSection() {
    const [events, setEvents] = useState<PublicEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchEvents() {
            try {
                const res = await fetch('/api/public/events');
                const data = await res.json();
                setEvents(Array.isArray(data.events) ? data.events : []);
            } catch {
                console.error('Failed to fetch events');
            } finally {
                setIsLoading(false);
            }
        }
        fetchEvents();
    }, []);

    if (isLoading) {
        return (
            <div className="mt-8 max-w-md mx-auto">
                <LoadingFrame label="Loading events" />
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <BoxyFrame className="mt-8 max-w-md mx-auto bg-card/40 p-8 text-center">
                <div className="w-14 h-14 mx-auto mb-4 bg-card border border-border flex items-center justify-center">
                    <svg className="w-7 h-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">No Events Yet</h2>
                <p className="text-muted-foreground text-sm">
                    There are no events available right now. Check back soon.
                </p>
            </BoxyFrame>
        );
    }

    return (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {events.map((event) => (
                <BoxyFrame key={event._id}>
                    <Link
                        href={`/event/${event._id}`}
                        className="group flex flex-col h-full bg-card/40 hover:bg-accent p-6 transition-all duration-200 text-center"
                    >
                        <div className="w-14 h-14 mx-auto mb-4 bg-card border border-border flex items-center justify-center">
                            <svg className="w-7 h-7 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">{event.title}</h3>
                        <p className="text-muted-foreground text-sm flex items-center justify-center gap-2 mb-3">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {format(new Date(event.date), 'PPP')}
                        </p>
                        {event.description && (
                            <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{event.description}</p>
                        )}
                        <div className="mt-auto pt-2">
                            <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-semibold group-hover:bg-foreground/90 transition-all">
                                {event.isPublicDownload ? 'Get Your Ticket' : 'View Event'}
                            </span>
                        </div>
                    </Link>
                </BoxyFrame>
            ))}
        </div>
    );
}
