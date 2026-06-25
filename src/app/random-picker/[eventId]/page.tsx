'use client';

import { use, useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingFrame } from '@/components/dot-matrix';

interface Registration {
    _id: string;
    name: string;
    regNo: string;
}

interface AttendeesResponse {
    event: { title: string };
    attendees: Registration[];
}

interface CurrentUser {
    role: 'admin' | 'event_admin' | 'app_user';
}

async function fetchAttendees(eventId: string): Promise<AttendeesResponse> {
    const res = await fetch(`/api/events/${eventId}/attendees`);
    if (!res.ok) throw new Error('Failed to load attendees');
    return res.json();
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
}

export default function RandomPickerPage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const { eventId } = use(params);

    const { data, isLoading, error } = useQuery({
        queryKey: ['picker-attendees', eventId],
        queryFn: () => fetchAttendees(eventId),
    });

    const { data: currentUser, isLoading: userLoading } = useQuery({
        queryKey: ['current-user'],
        queryFn: fetchCurrentUser,
    });

    const [winner, setWinner] = useState<Registration | null>(null);
    const [display, setDisplay] = useState<Registration | null>(null);
    const [rolling, setRolling] = useState(false);
    const [scale, setScale] = useState(1); // multiplier for the reg-no / name display size
    const incScale = () => setScale((s) => Math.min(2.5, +(s + 0.15).toFixed(2)));
    const decScale = () => setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)));
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Clean up the shuffle timers if the component unmounts mid-draw.
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const pool = data?.attendees ?? [];

    const draw = () => {
        if (rolling || pool.length === 0) return;
        setRolling(true);
        setWinner(null);

        // Cycle through random attendees, then lock onto the final pick.
        intervalRef.current = setInterval(() => {
            setDisplay(pool[Math.floor(Math.random() * pool.length)]);
        }, 70);

        timeoutRef.current = setTimeout(() => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            const chosen = pool[Math.floor(Math.random() * pool.length)];
            setDisplay(chosen);
            setWinner(chosen);
            setRolling(false);
        }, 1600);
    };

    if (isLoading || userLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <LoadingFrame label="Loading picker" />
            </div>
        );
    }

    // Client-side gate (the API also enforces access server-side).
    const canAccess = currentUser?.role === 'admin' || currentUser?.role === 'event_admin';
    if (!canAccess) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <p className="text-rose-300 text-sm">
                    You don&apos;t have access to the picker for this event.
                </p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <p className="text-rose-300 text-sm">Failed to load the event.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col p-5 sm:p-8">
            {/* Draw stage */}
            <div className="flex-1 flex flex-col items-center justify-center gap-10">
                {pool.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        No attendees marked present yet — nobody to draw from.
                    </p>
                ) : (
                    <>
                        <div className="flex flex-col items-center gap-4 text-center">
                            <span className="font-serif text-3xl sm:text-4xl text-foreground">
                                {data.event.title}
                            </span>
                            <span
                                className={`font-mono font-bold tabular-nums tracking-tight text-foreground transition-colors duration-200 leading-none ${rolling ? 'opacity-60' : 'opacity-100'}`}
                                style={{ fontSize: `min(${9 * scale}rem, ${22 * scale}vw)` }}
                            >
                                {display ? display.regNo : '——'}
                            </span>
                            <span
                                className={`font-serif leading-tight transition-opacity duration-300 ${winner ? 'text-gradient-name opacity-100' : 'text-muted-foreground opacity-70'}`}
                                style={{ fontSize: `min(${3.5 * scale}rem, ${11 * scale}vw)` }}
                            >
                                {display ? display.name : ' '}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={draw}
                            disabled={rolling}
                            className="pill bg-foreground text-background font-medium text-sm px-10 py-3 transition-colors hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {rolling ? 'Drawing…' : winner ? 'Draw again' : 'Draw winner'}
                        </button>
                    </>
                )}
            </div>

            {/* Size controls — adjust the reg-no / name display size */}
            {pool.length > 0 && (
                <div className="fixed bottom-5 right-5 flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={decScale}
                        disabled={scale <= 0.5}
                        aria-label="Decrease size"
                        className="flex h-9 w-9 items-center justify-center border border-border bg-card text-lg font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        −
                    </button>
                    <span className="min-w-[3rem] text-center text-xs tabular-nums text-muted-foreground">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        type="button"
                        onClick={incScale}
                        disabled={scale >= 2.5}
                        aria-label="Increase size"
                        className="flex h-9 w-9 items-center justify-center border border-border bg-card text-lg font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        +
                    </button>
                </div>
            )}
        </div>
    );
}
