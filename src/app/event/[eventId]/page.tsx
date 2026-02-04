'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EventDetails {
    _id: string;
    title: string;
    date: string;
}

export default function PublicEventPage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const { eventId } = use(params);
    const [event, setEvent] = useState<EventDetails | null>(null);
    const [isLoadingEvent, setIsLoadingEvent] = useState(true);
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);

    useEffect(() => {
        async function fetchEvent() {
            try {
                const res = await fetch(`/api/public/events?eventId=${eventId}`);
                const data = await res.json();
                const foundEvent = data.events?.find((e: EventDetails) => e._id === eventId);
                setEvent(foundEvent || null);
            } catch {
                console.error('Failed to fetch event');
            } finally {
                setIsLoadingEvent(false);
            }
        }
        fetchEvent();
    }, [eventId]);

    async function handleDownload(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!email || !phone) {
            setError('Please fill in all fields');
            return;
        }

        setIsDownloading(true);
        setDownloadProgress(0);

        // Progress animation
        const progressInterval = setInterval(() => {
            setDownloadProgress((prev) => {
                if (prev >= 90) return prev;
                return prev + Math.random() * 15;
            });
        }, 100);

        try {
            // Fetch ticket data from API
            const res = await fetch('/api/public/ticket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, email, phone }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Download failed');
            }

            const ticketData = await res.json();
            const { qrPayload, name, templateUrl, qrPosition, namePosition, eventTitle } = ticketData;

            // Dynamically import qr-code-styling (client-side only)
            const QRCodeStyling = (await import('qr-code-styling')).default;

            // Generate QR code with logo
            const qrCode = new QRCodeStyling({
                width: qrPosition.width,
                height: qrPosition.height,
                data: qrPayload,
                image: '/thanima_logo.jpg',
                dotsOptions: {
                    color: '#000000',
                    type: 'square',
                },
                backgroundOptions: {
                    color: '#ffffff',
                },
                imageOptions: {
                    crossOrigin: 'anonymous',
                    imageSize: 0.4,
                    margin: 4,
                },
                qrOptions: {
                    errorCorrectionLevel: 'H',
                },
            });

            // Get QR as blob
            const qrBlob = await qrCode.getRawData('png');
            if (!qrBlob) throw new Error('Failed to generate QR code');

            // Load template image
            const templateImg = new Image();
            templateImg.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                templateImg.onload = resolve;
                templateImg.onerror = reject;
                templateImg.src = templateUrl;
            });

            // Load QR image
            const qrImg = new Image();
            await new Promise((resolve, reject) => {
                qrImg.onload = resolve;
                qrImg.onerror = reject;
                qrImg.src = URL.createObjectURL(qrBlob as Blob);
            });

            // Create canvas and composite
            const canvas = document.createElement('canvas');
            canvas.width = templateImg.width;
            canvas.height = templateImg.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Failed to get canvas context');

            // Draw template
            ctx.drawImage(templateImg, 0, 0);

            // Draw QR code
            ctx.drawImage(qrImg, qrPosition.x, qrPosition.y, qrPosition.width, qrPosition.height);

            // Draw name
            ctx.font = `bold ${namePosition.fontSize}px Arial`;
            ctx.fillStyle = namePosition.color;
            ctx.fillText(name, namePosition.x, namePosition.y);

            clearInterval(progressInterval);
            setDownloadProgress(100);

            // Download the canvas as PNG
            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_');
                const sanitizedEvent = eventTitle.replace(/[^a-zA-Z0-9]/g, '_');
                a.download = `${sanitizedName}_${sanitizedEvent}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 'image/png');

            setSuccess(true);
            setTimeout(() => setSuccess(false), 5000);
        } catch (err) {
            clearInterval(progressInterval);
            setError(err instanceof Error ? err.message : 'Download failed');
        } finally {
            setTimeout(() => {
                setIsDownloading(false);
                setDownloadProgress(0);
            }, 300);
        }
    }

    if (isLoadingEvent) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                {/* Ambient Effects */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
                </div>
                <div className="relative z-10 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 relative">
                        <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-gray-400">Loading event...</p>
                </div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
                {/* Ambient Effects */}
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
                        Back to Events
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Ambient Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-purple-500/5 to-pink-500/5 rounded-full blur-3xl"></div>
            </div>

            {/* Header */}
            <header className="relative z-10 border-b border-white/5">
                <div className="max-w-6xl mx-auto px-4 sm:px-6">
                    <div className="flex items-center h-16">
                        <Link
                            href="/"
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                        >
                            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span>Back</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="relative z-10 py-12 px-4">
                <div className="max-w-md mx-auto">
                    {/* Event Title Card */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6">
                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm text-gray-300">{format(new Date(event.date), 'PPPP')}</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                            {event.title}
                        </h1>
                        <p className="text-gray-500">Enter your details to download your ticket</p>
                    </div>

                    {/* Download Form Card */}
                    <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6 sm:p-8">
                        <form onSubmit={handleDownload} className="space-y-5">
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
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl focus:border-purple-500/50 focus:ring-purple-500/20 transition-all"
                                    disabled={isDownloading}
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
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl focus:border-purple-500/50 focus:ring-purple-500/20 transition-all"
                                    disabled={isDownloading}
                                    required
                                />
                            </div>

                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-3">
                                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{error}</span>
                                </div>
                            )}

                            {success && (
                                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm flex items-start gap-3">
                                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Ticket downloaded successfully! Check your downloads folder.</span>
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={isDownloading}
                                className="w-full h-12 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white font-semibold text-base rounded-xl shadow-lg shadow-purple-500/25 transition-all relative overflow-hidden disabled:opacity-70"
                            >
                                {isDownloading ? (
                                    <>
                                        {/* Progress bar animation */}
                                        <div
                                            className="absolute inset-0 bg-white/20 transition-all duration-100 ease-out"
                                            style={{ width: `${downloadProgress}%` }}
                                        />
                                        <span className="relative flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Generating Ticket...
                                        </span>
                                    </>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Download Ticket
                                    </span>
                                )}
                            </Button>
                        </form>
                    </div>

                    {/* Help Text */}
                    <p className="text-center text-gray-600 text-sm mt-6">
                        Make sure you use the same email and phone number you registered with.
                    </p>
                </div>
            </main>
        </div>
    );
}
