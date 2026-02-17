'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

interface PublicEvent {
    _id: string;
    title: string;
    date: string;
    description?: string;
    isPublicDownload?: boolean;
    hasVisibleQuiz?: boolean;
}

export function PublicEventsSection() {
    const [event, setEvent] = useState<PublicEvent | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchActiveEvent() {
            try {
                const res = await fetch('/api/public/events');
                const data = await res.json();
                setEvent(data.activeEvent || null);
            } catch {
                console.error('Failed to fetch active event');
            } finally {
                setIsLoading(false);
            }
        }
        fetchActiveEvent();
    }, []);

    if (isLoading) {
        return (
            <div className="mt-8 max-w-md mx-auto">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 animate-pulse">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl mx-auto mb-4"></div>
                    <div className="h-7 bg-white/10 rounded w-3/4 mx-auto mb-3"></div>
                    <div className="h-4 bg-white/10 rounded w-1/2 mx-auto mb-4"></div>
                    <div className="h-12 bg-white/10 rounded-xl w-full"></div>
                </div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="mt-8 max-w-md mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <div className="w-14 h-14 mx-auto mb-4 bg-gray-600/20 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <h2 className="text-lg font-semibold text-white mb-2">No Active Event</h2>
                <p className="text-gray-500 text-sm">
                    There is no event currently available for ticket downloads.
                </p>
            </div>
        );
    }

    return (
        <div className="mt-8 max-w-md mx-auto">
            <Link
                href={`/event/${event._id}`}
                className="group block bg-gradient-to-b from-white/[0.08] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.04] border border-white/10 hover:border-purple-500/50 rounded-2xl p-8 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/10 text-center"
            >
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                    {event.title}
                </h3>
                <p className="text-gray-500 text-sm flex items-center justify-center gap-2 mb-4">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {format(new Date(event.date), 'PPP')}
                </p>
                {event.description && (
                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {event.description}
                    </p>
                )}
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl text-white font-semibold shadow-lg shadow-purple-500/25 group-hover:from-purple-600 group-hover:to-purple-700 transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    {event.isPublicDownload && event.hasVisibleQuiz
                        ? 'Get Ticket & Join Quiz'
                        : event.isPublicDownload
                            ? 'Get Your Ticket'
                            : event.hasVisibleQuiz
                                ? 'Participate in Quiz'
                                : 'View Event'}
                </div>
            </Link>
        </div>
    );
}
