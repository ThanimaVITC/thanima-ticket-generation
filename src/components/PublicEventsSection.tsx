'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

interface PublicEvent {
    _id: string;
    title: string;
    date: string;
}

export function PublicEventsSection() {
    const [events, setEvents] = useState<PublicEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchEvents() {
            try {
                const res = await fetch('/api/public/events');
                const data = await res.json();
                setEvents(data.events || []);
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
            <div className="flex flex-wrap justify-center gap-4 mt-8">
                {[1, 2].map((i) => (
                    <div
                        key={i}
                        className="w-full max-w-xs bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse"
                    >
                        <div className="h-6 bg-white/10 rounded w-3/4 mx-auto mb-3"></div>
                        <div className="h-4 bg-white/10 rounded w-1/2 mx-auto"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="mt-8 max-w-md mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <div className="w-14 h-14 mx-auto mb-4 bg-gray-600/20 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <h2 className="text-lg font-semibold text-white mb-2">No Events Available</h2>
                <p className="text-gray-500 text-sm">
                    There are no events with ticket downloads available at the moment.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap justify-center gap-4 mt-8">
            {events.map((event) => (
                <Link
                    key={event._id}
                    href={`/event/${event._id}`}
                    className="group w-full max-w-xs bg-gradient-to-b from-white/[0.08] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.04] border border-white/10 hover:border-purple-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/10 text-center"
                >
                    <div className="w-12 h-12 mx-auto mb-4 bg-purple-600/20 rounded-xl flex items-center justify-center group-hover:bg-purple-600/40 transition-colors">
                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
                        {event.title}
                    </h3>
                    <p className="text-gray-500 text-sm flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {format(new Date(event.date), 'PPP')}
                    </p>
                </Link>
            ))}
        </div>
    );
}
