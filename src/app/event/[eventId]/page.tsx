'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { LoadingFrame, DotMatrixLoader } from '@/components/dot-matrix';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BoxyFrame } from '@/components/boxy';

interface EventDetails {
    _id: string;
    title: string;
    date: string;
    isPublicDownload?: boolean;
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
    const [regNoInput, setRegNoInput] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState('');

    // Ticket state
    const [ticketImageUrl, setTicketImageUrl] = useState<string | null>(null);
    const [isGeneratingTicket, setIsGeneratingTicket] = useState(false);
    const [ticketError, setTicketError] = useState('');
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [rotateTicket, setRotateTicket] = useState(false);

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
            const { qrPayload, name, regNo, templateUrl, qrPosition, namePosition, regNoPosition, rotateTicket: shouldRotate } = ticketData;

            // Store rotation preference
            setRotateTicket(shouldRotate || false);

            // Dynamically import QR library
            const QRCodeStyling = (await import('qr-code-styling')).default;

            const qrCode = new QRCodeStyling({
                width: qrPosition.width,
                height: qrPosition.height,
                data: qrPayload,
                dotsOptions: { color: '#000000', type: 'square' },
                backgroundOptions: { color: '#ffffff' },
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

    // Auto-generate ticket when user logs in, no cached ticket, and downloads are enabled
    useEffect(() => {
        if (user && !ticketImageUrl && !isGeneratingTicket && event && event.isPublicDownload) {
            generateTicket();
        }
    }, [user, ticketImageUrl, isGeneratingTicket, event, generateTicket]);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoginError('');

        if (!email || !regNoInput) {
            setLoginError('Please fill in all fields');
            return;
        }

        setIsLoggingIn(true);
        try {
            const res = await fetch('/api/public/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, email, regNo: regNoInput }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }

            setUser({
                ...data.user,
                eventId,
                phone: data.user.phone || '',
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

        // If rotation is enabled, create a rotated version for download
        if (rotateTicket) {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Swap dimensions for 90-degree rotation
                canvas.width = img.height;
                canvas.height = img.width;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Rotate 90 degrees clockwise
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate((90 * Math.PI) / 180);
                ctx.drawImage(img, -img.width / 2, -img.height / 2);

                const rotatedDataUrl = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = rotatedDataUrl;
                const sanitizedName = user.name.replace(/[^a-zA-Z0-9]/g, '_');
                const sanitizedEvent = event.title.replace(/[^a-zA-Z0-9]/g, '_');
                a.download = `${sanitizedName}_${sanitizedEvent}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };
            img.src = ticketImageUrl;
        } else {
            const a = document.createElement('a');
            a.href = ticketImageUrl;
            const sanitizedName = user.name.replace(/[^a-zA-Z0-9]/g, '_');
            const sanitizedEvent = event.title.replace(/[^a-zA-Z0-9]/g, '_');
            a.download = `${sanitizedName}_${sanitizedEvent}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    }

    // Loading state
    if (isLoadingEvent || isCheckingAuth) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="relative z-10 text-center">
                    <LoadingFrame label="Loading" />
                </div>
            </div>
        );
    }

    // Event not found
    if (!event) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <div className="relative z-10 text-center max-w-md">
                    <div className="w-20 h-20 mx-auto mb-6 bg-card/40 flex items-center justify-center border border-border">
                        <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-3">Event Not Available</h1>
                    <p className="text-muted-foreground mb-8">
                        This event does not have ticket downloads enabled or may not exist.
                    </p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-card hover:bg-accent border border-border hover:border-border text-foreground font-medium transition-all"
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

    // Ticket download must be enabled — otherwise the page is restricted
    // (guards against someone manually typing the URL).
    if (!event.isPublicDownload) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <div className="relative z-10 text-center max-w-md">
                    <div className="w-20 h-20 mx-auto mb-6 bg-card/40 flex items-center justify-center border border-border">
                        <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-3">Ticket Download Restricted</h1>
                    <p className="text-muted-foreground mb-8">
                        Ticket downloads aren&apos;t open for {event.title}. Your ticket will be sent to you by email.
                    </p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-card hover:bg-accent border border-border text-foreground font-medium transition-all"
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
            <div className="min-h-screen bg-background">
                {/* Header */}
                <header className="relative z-10 border-b border-border bg-background/50 backdrop-blur-xl">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6">
                        <div className="flex items-center justify-between h-16">
                            <Link href="/" className="flex items-center space-x-3">
                                <Image src="/thanima_logo.jpg" alt="Thanima" width={36} height={36} />
                                <span className="text-foreground font-semibold text-lg tracking-tight">Thanima</span>
                            </Link>
                            <div className="flex items-center gap-4">
                                <span className="hidden sm:block text-muted-foreground text-sm">{user.name}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLogout}
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

                {/* Main Content — render the ticket directly */}
                <main className="relative z-10 py-10 px-4">
                    <div className="max-w-md mx-auto text-center">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your Ticket</p>
                        <h1 className="mt-2 font-serif text-3xl sm:text-4xl tracking-tight text-gradient-name leading-[1.05]" style={{ animationDelay: `-${event.title.length % 8}s` }}>{event.title}</h1>
                        <p className="mt-2 text-muted-foreground text-sm">{user.name} • {format(new Date(event.date), 'PPP')}</p>

                        <div className="mt-8">
                            {isGeneratingTicket && (
                                <BoxyFrame className="bg-card/40 py-14 flex flex-col items-center justify-center gap-4">
                                    <DotMatrixLoader columns={7} rows={3} />
                                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Generating your ticket…</p>
                                </BoxyFrame>
                            )}

                            {ticketError && !isGeneratingTicket && (
                                <BoxyFrame className="bg-card/40 p-6">
                                    <p className="text-rose-300 text-sm mb-4">{ticketError}</p>
                                    <Button onClick={generateTicket}>Try Again</Button>
                                </BoxyFrame>
                            )}

                            {ticketImageUrl && !isGeneratingTicket && (
                                <div className="space-y-5">
                                    <BoxyFrame className="bg-card/40 p-3">
                                        <img
                                            src={ticketImageUrl}
                                            alt="Your Ticket"
                                            className="w-full max-w-full object-contain"
                                        />
                                    </BoxyFrame>
                                    <Button onClick={downloadTicket} className="w-full h-11">
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Download Ticket
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // Login Form (not logged in)
    return (
        <div className="min-h-screen bg-background">
            <header className="relative z-10 border-b border-border">
                <div className="max-w-6xl mx-auto px-4 sm:px-6">
                    <div className="flex items-center h-16">
                        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group">
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
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border mb-6">
                            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm text-muted-foreground">{format(new Date(event.date), 'PPPP')}</span>
                        </div>
                        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-gradient-name leading-[1.05]" style={{ animationDelay: `-${event.title.length % 8}s` }}>{event.title}</h1>
                    </div>

                    <BoxyFrame className="bg-card/40 p-6 sm:p-8">
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-muted-foreground text-sm font-medium">
                                    Email Address
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-card border border-border text-foreground placeholder:text-muted-foreground h-12"
                                    disabled={isLoggingIn}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="regNo" className="text-muted-foreground text-sm font-medium">
                                    Registration Number
                                </Label>
                                <Input
                                    id="regNo"
                                    type="text"
                                    placeholder="22BCE1234"
                                    value={regNoInput}
                                    onChange={(e) => setRegNoInput(e.target.value)}
                                    className="bg-card border border-border text-foreground placeholder:text-muted-foreground h-12"
                                    disabled={isLoggingIn}
                                    required
                                />
                            </div>

                            {loginError && (
                                <div className="p-4 bg-rose-900/20 border border-rose-900/60 text-rose-300 text-sm flex items-start gap-3">
                                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{loginError}</span>
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={isLoggingIn}
                                className="w-full h-12 font-semibold text-base"
                            >
                                {isLoggingIn ? (
                                    <span className="flex items-center justify-center gap-2">
                                        Logging in…
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
                    </BoxyFrame>

                    <p className="text-center text-muted-foreground text-sm mt-6">
                        Use the same email and registration number you registered with.
                    </p>
                </div>
            </main>
        </div>
    );
}
