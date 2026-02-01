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
            <section className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                        Available Events
                    </h1>
                    <p className="text-gray-400">
                        Select an event to download your ticket
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse"
                        >
                            <div className="h-6 bg-white/10 rounded w-3/4 mb-3"></div>
                            <div className="h-4 bg-white/10 rounded w-1/2"></div>
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (events.length === 0) {
        return (
            <section className="max-w-4xl mx-auto text-center">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-600/20 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">No Events Available</h2>
                    <p className="text-gray-400">
                        There are no events with ticket downloads available at the moment.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                    Available Events
                </h1>
                <p className="text-gray-400">
                    Select an event to download your ticket
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {events.map((event) => (
                    <Link
                        key={event._id}
                        href={`/event/${event._id}`}
                        className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/10"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
                                    {event.title}
                                </h3>
                                <p className="text-gray-400 text-sm flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {format(new Date(event.date), 'PPP')}
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center group-hover:bg-purple-600/40 transition-colors">
                                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
