'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QuizSection } from '@/components/QuizSection';

interface EventDetails {
    _id: string;
    title: string;
    date: string;
}

interface User {
    name: string;
    email: string;
    regNo: string;
    phone: string;
    eventId: string;
}

interface CachedTicket {
    imageDataUrl: string;
    generatedAt: number;
}

export default function PublicEventPage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const { eventId } = use(params);
    const [event, setEvent] = useState<EventDetails | null>(null);
    const [isLoadingEvent, setIsLoadingEvent] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    // Login form state
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState('');

    // Ticket state
    const [ticketImageUrl, setTicketImageUrl] = useState<string | null>(null);
    const [isGeneratingTicket, setIsGeneratingTicket] = useState(false);
    const [ticketError, setTicketError] = useState('');
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);

    // Check if user is already logged in for this event
    useEffect(() => {
        async function checkAuth() {
            try {
                const res = await fetch('/api/public/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    // Only set user if logged in to THIS event
                    if (data.user?.eventId === eventId) {
                        setUser(data.user);
                    }
                }
            } catch {
                console.error('Auth check failed');
            } finally {
                setIsCheckingAuth(false);
            }
        }
        checkAuth();
    }, [eventId]);

    // Fetch event details
    useEffect(() => {
        async function fetchEvent() {
            try {
                const res = await fetch(`/api/public/events?eventId=${eventId}`);
                const data = await res.json();
                const foundEvent = data.events?.find((e: EventDetails) => e._id === eventId) || data.activeEvent;
                setEvent(foundEvent || null);
            } catch {
                console.error('Failed to fetch event');
            } finally {
                setIsLoadingEvent(false);
            }
        }
        fetchEvent();
    }, [eventId]);

    // Load cached ticket if exists
    useEffect(() => {
        if (user) {
            const cacheKey = `ticket_v2_${eventId}_${user.regNo}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const data: CachedTicket = JSON.parse(cached);
                    // Cache valid for 24 hours
                    if (Date.now() - data.generatedAt < 24 * 60 * 60 * 1000) {
                        setTicketImageUrl(data.imageDataUrl);
                    }
                } catch {
                    localStorage.removeItem(cacheKey);
                }
            }
        }
    }, [user, eventId]);

    // Generate ticket function
    const generateTicket = useCallback(async () => {
        if (!user || !event) return;

        setIsGeneratingTicket(true);
        setTicketError('');
        setDownloadProgress(0);

        const progressInterval = setInterval(() => {
            setDownloadProgress((prev) => {
                if (prev >= 90) return prev;
                return prev + Math.random() * 15;
            });
        }, 100);

        try {
            const res = await fetch('/api/public/ticket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, email: user.email, phone: user.phone }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to generate ticket');
            }

            const ticketData = await res.json();
            const { qrPayload, name, regNo, templateUrl, qrPosition, namePosition, regNoPosition } = ticketData;

            // Dynamically import QR library
            const QRCodeStyling = (await import('qr-code-styling')).default;

            const qrCode = new QRCodeStyling({
                width: qrPosition.width,
                height: qrPosition.height,
                data: qrPayload,
                image: '/thanima_logo.jpg',
                dotsOptions: { color: '#000000', type: 'square' },
                backgroundOptions: { color: '#ffffff' },
                imageOptions: { crossOrigin: 'anonymous', imageSize: 0.4, margin: 4 },
                qrOptions: { errorCorrectionLevel: 'H' },
            });

            const qrBlob = await qrCode.getRawData('png');
            if (!qrBlob) throw new Error('Failed to generate QR code');

            // Load images
            const templateImg = new window.Image();
            templateImg.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                templateImg.onload = resolve;
                templateImg.onerror = reject;
                templateImg.src = templateUrl;
            });

            const qrImg = new window.Image();
            await new Promise((resolve, reject) => {
                qrImg.onload = resolve;
                qrImg.onerror = reject;
                qrImg.src = URL.createObjectURL(qrBlob as Blob);
            });

            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = templateImg.width;
            canvas.height = templateImg.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Failed to get canvas context');

            ctx.drawImage(templateImg, 0, 0);
            ctx.drawImage(qrImg, qrPosition.x, qrPosition.y, qrPosition.width, qrPosition.height);

            // Draw Name
            ctx.font = `bold ${namePosition.fontSize}px Arial`;
            ctx.fillStyle = namePosition.color;
            ctx.fillText(name, namePosition.x, namePosition.y);

            // Draw RegNo
            if (regNo && regNoPosition) {
                ctx.font = `bold ${regNoPosition.fontSize}px Arial`;
                ctx.fillStyle = regNoPosition.color;
                ctx.fillText(regNo, regNoPosition.x, regNoPosition.y);
            }

            clearInterval(progressInterval);
            setDownloadProgress(100);

            const imageDataUrl = canvas.toDataURL('image/png');
            setTicketImageUrl(imageDataUrl);

            // Cache ticket
            const cacheKey = `ticket_v2_${eventId}_${user.regNo}`;
            localStorage.setItem(cacheKey, JSON.stringify({
                imageDataUrl,
                generatedAt: Date.now(),
            } as CachedTicket));

        } catch (err) {
            clearInterval(progressInterval);
            setTicketError(err instanceof Error ? err.message : 'Failed to generate ticket');
        } finally {
            setTimeout(() => {
                setIsGeneratingTicket(false);
                setDownloadProgress(0);
            }, 300);
        }
    }, [user, event, eventId]);

    // Auto-generate ticket when user logs in and no cached ticket
    useEffect(() => {
        if (user && !ticketImageUrl && !isGeneratingTicket && event) {
            generateTicket();
        }
    }, [user, ticketImageUrl, isGeneratingTicket, event, generateTicket]);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoginError('');

        if (!email || !phone) {
            setLoginError('Please fill in all fields');
            return;
        }

        setIsLoggingIn(true);
        try {
            const res = await fetch('/api/public/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, email, phone }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }

            setUser({
                ...data.user,
                eventId,
                phone,
            });
        } catch (err) {
            setLoginError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setIsLoggingIn(false);
        }
    }

    async function handleLogout() {
        try {
            await fetch('/api/public/auth/logout', { method: 'POST' });
            setUser(null);
            setTicketImageUrl(null);
            if (user) {
                localStorage.removeItem(`ticket_v2_${eventId}_${user.regNo}`);
            }
        } catch {
            console.error('Logout failed');
        }
    }

    function downloadTicket() {
        if (!ticketImageUrl || !user || !event) return;

        const a = document.createElement('a');
        a.href = ticketImageUrl;
        const sanitizedName = user.name.replace(/[^a-zA-Z0-9]/g, '_');
        const sanitizedEvent = event.title.replace(/[^a-zA-Z0-9]/g, '_');
        a.download = `${sanitizedName}_${sanitizedEvent}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // Loading state
    if (isLoadingEvent || isCheckingAuth) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
                </div>
                <div className="relative z-10 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 relative">
                        <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    // Event not found
    if (!event) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl"></div>
                </div>
                <div className="relative z-10 text-center max-w-md">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center border border-red-500/20">
                        <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-3">Event Not Available</h1>
                    <p className="text-gray-400 mb-8">
                        This event does not have ticket downloads enabled or may not exist.
                    </p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl font-medium transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    // User Dashboard (logged in)
    if (user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
                </div>

                {/* Header */}
                <header className="relative z-10 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6">
                        <div className="flex items-center justify-between h-16">
                            <Link href="/" className="flex items-center space-x-3">
                                <Image src="/thanima_logo.jpg" alt="Thanima" width={36} height={36} className="rounded-xl" />
                                <span className="text-white font-semibold text-lg tracking-tight">Thanima</span>
                            </Link>
                            <div className="flex items-center gap-4">
                                <span className="hidden sm:block text-gray-400 text-sm">{user.name}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLogout}
                                    className="text-gray-400 hover:text-white hover:bg-white/5 rounded-xl"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    Logout
                                </Button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="relative z-10 py-8 px-4">
                    <div className="max-w-4xl mx-auto">
                        {/* Welcome Section */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-white mb-2">Welcome, {user.name}!</h1>
                            <p className="text-gray-400">{event.title} • {format(new Date(event.date), 'PPPP')}</p>
                        </div>

                        {/* Stats - No Card */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 sm:gap-6 mb-8 px-2">
                            <div className="sm:border-r border-white/10 sm:pr-6">
                                <p className="text-gray-500 text-xs sm:text-sm uppercase tracking-wider mb-1">Registration No</p>
                                <p className="text-xl sm:text-2xl font-bold text-white font-mono">{user.regNo}</p>
                            </div>
                            <div className="sm:border-r border-white/10 sm:pr-6">
                                <p className="text-gray-500 text-xs sm:text-sm uppercase tracking-wider mb-1">Email</p>
                                <p className="text-base sm:text-lg font-medium text-white truncate">{user.email}</p>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs sm:text-sm uppercase tracking-wider mb-1">Phone</p>
                                <p className="text-base sm:text-lg font-medium text-white">{user.phone}</p>
                            </div>
                        </div>

                        {/* Ticket Section */}
                        <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6 mb-8">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">Your Ticket</h2>
                                    <p className="text-gray-500 text-sm">View or download your event ticket</p>
                                </div>
                                <div className="flex gap-3 w-full sm:w-auto">
                                    <Button
                                        onClick={() => setShowTicketModal(true)}
                                        disabled={!ticketImageUrl || isGeneratingTicket}
                                        className="flex-1 sm:flex-none bg-white/10 hover:bg-white/20 text-white rounded-xl"
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        View Ticket
                                    </Button>
                                    <Button
                                        onClick={downloadTicket}
                                        disabled={!ticketImageUrl || isGeneratingTicket}
                                        className="flex-1 sm:flex-none bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white rounded-xl shadow-lg shadow-purple-500/25"
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Download
                                    </Button>
                                </div>
                            </div>

                            {isGeneratingTicket && (
                                <div className="bg-white/5 rounded-xl p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <svg className="animate-spin h-5 w-5 text-purple-500" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        <span className="text-gray-300">Generating your ticket...</span>
                                    </div>
                                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-100"
                                            style={{ width: `${downloadProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {ticketError && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-3">
                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{ticketError}</span>
                                    <Button size="sm" variant="ghost" onClick={generateTicket} className="ml-auto text-red-400 hover:text-red-300">
                                        Retry
                                    </Button>
                                </div>
                            )}

                            {ticketImageUrl && !isGeneratingTicket && (
                                <div className="text-center text-green-400 text-sm flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Ticket ready!
                                </div>
                            )}
                        </div>

                        {/* Quiz Section */}
                        <QuizSection eventId={eventId} regNo={user.regNo} />
                    </div>
                </main>

                {/* Ticket Modal */}
                {showTicketModal && ticketImageUrl && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setShowTicketModal(false)}>
                        <div className="relative w-full max-w-lg flex flex-col items-center justify-center pointer-events-none" onClick={(e) => e.stopPropagation()}>
                            <div className="relative pointer-events-auto">
                                <Button
                                    onClick={() => setShowTicketModal(false)}
                                    className="absolute -top-12 right-0 sm:-right-12 sm:top-0 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 p-0"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </Button>
                                <img
                                    src={ticketImageUrl}
                                    alt="Your Ticket"
                                    className="max-h-[85vh] w-auto max-w-full rounded-xl shadow-2xl object-contain"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Login Form (not logged in)
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-purple-500/5 to-pink-500/5 rounded-full blur-3xl"></div>
            </div>

            <header className="relative z-10 border-b border-white/5">
                <div className="max-w-6xl mx-auto px-4 sm:px-6">
                    <div className="flex items-center h-16">
                        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
                            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span>Back</span>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="relative z-10 py-12 px-4">
                <div className="max-w-md mx-auto">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6">
                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm text-gray-300">{format(new Date(event.date), 'PPPP')}</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{event.title}</h1>
                        <p className="text-gray-500">Enter your details to access your dashboard</p>
                    </div>

                    <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6 sm:p-8">
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-gray-300 text-sm font-medium">
                                    Email Address
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl focus:border-purple-500/50 focus:ring-purple-500/20"
                                    disabled={isLoggingIn}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-gray-300 text-sm font-medium">
                                    Phone Number
                                </Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="9876543210"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl focus:border-purple-500/50 focus:ring-purple-500/20"
                                    disabled={isLoggingIn}
                                    required
                                />
                            </div>

                            {loginError && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-3">
                                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{loginError}</span>
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={isLoggingIn}
                                className="w-full h-12 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white font-semibold text-base rounded-xl shadow-lg shadow-purple-500/25 transition-all"
                            >
                                {isLoggingIn ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Logging in...
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                        </svg>
                                        Access Dashboard
                                    </span>
                                )}
                            </Button>
                        </form>
                    </div>

                    <p className="text-center text-gray-600 text-sm mt-6">
                        Use the same email and phone number you registered with.
                    </p>
                </div>
            </main>
        </div>
    );
}
