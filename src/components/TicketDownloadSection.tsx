'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PublicEvent {
    _id: string;
    title: string;
    date: string;
}

export function TicketDownloadSection() {
    const [events, setEvents] = useState<PublicEvent[]>([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        async function fetchEvents() {
            try {
                const res = await fetch('/api/public/events');
                const data = await res.json();
                setEvents(data.events || []);
                if (data.events?.length === 1) {
                    setSelectedEventId(data.events[0]._id);
                }
            } catch {
                console.error('Failed to fetch events');
            }
        }
        fetchEvents();
    }, []);

    async function handleDownload(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!selectedEventId || !email || !phone) {
            setError('Please fill in all fields');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/public/ticket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: selectedEventId, email, phone }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Download failed');
            }

            const data = await res.json();

            // Generate Ticket Image
            await generateAndDownloadTicket(data);

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Download failed');
        } finally {
            setIsLoading(false);
        }
    }

    async function generateAndDownloadTicket(data: any) {
        const { qrPayload, name, regNo, templateUrl, qrPosition, namePosition, regNoPosition, rotateTicket } = data;

        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create canvas context');

        // Load template image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = templateUrl;
        });

        // Set canvas size to image size
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw template
        ctx.drawImage(img, 0, 0);

        // Generate QR Code
        const qrDataUrl = await QRCode.toDataURL(qrPayload, {
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        const qrImg = new Image();
        await new Promise((resolve, reject) => {
            qrImg.onload = resolve;
            qrImg.onerror = reject;
            qrImg.src = qrDataUrl;
        });

        // Draw QR Code
        if (qrPosition) {
            ctx.drawImage(qrImg, qrPosition.x, qrPosition.y, qrPosition.width, qrPosition.height);
        }

        // Draw Name
        if (namePosition) {
            ctx.fillStyle = namePosition.color || '#000000';
            const fontFamily = namePosition.fontFamily || 'Arial';
            ctx.font = `bold ${namePosition.fontSize}px ${fontFamily}`;
            ctx.fillText(name, namePosition.x, namePosition.y);
        }

        // Draw RegNo
        if (regNoPosition && regNo) {
            ctx.fillStyle = regNoPosition.color || '#000000';
            const fontFamily = regNoPosition.fontFamily || 'Arial';
            ctx.font = `bold ${regNoPosition.fontSize}px ${fontFamily}`;
            ctx.fillText(regNo, regNoPosition.x, regNoPosition.y);
        }

        // Get final image URL - apply rotation if needed
        let finalUrl: string;
        if (rotateTicket) {
            const rotatedCanvas = document.createElement('canvas');
            rotatedCanvas.width = canvas.height;
            rotatedCanvas.height = canvas.width;
            const rotatedCtx = rotatedCanvas.getContext('2d');
            if (!rotatedCtx) throw new Error('Could not create rotated canvas context');

            rotatedCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
            rotatedCtx.rotate((90 * Math.PI) / 180);
            rotatedCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

            finalUrl = rotatedCanvas.toDataURL('image/png');
        } else {
            finalUrl = canvas.toDataURL('image/png');
        }

        // Trigger Download
        const a = document.createElement('a');
        a.href = finalUrl;
        a.download = `ticket_${regNo || email.split('@')[0]}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    if (events.length === 0) {
        return null;
    }

    return (
        <div className="max-w-md mx-auto px-4">
            <Card className="bg-white/5 backdrop-blur-lg border-white/10 shadow-2xl">
                <CardHeader className="text-center pb-4">
                    <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/25">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">Download Your Ticket</CardTitle>
                    <CardDescription className="text-gray-400">
                        Enter your registered details to download
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleDownload} className="space-y-4">
                        {events.length > 1 && (
                            <div className="space-y-2">
                                <Label htmlFor="event" className="text-gray-300">Select Event</Label>
                                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                                        <SelectValue placeholder="Choose an event" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-white/20">
                                        {events.map((event) => (
                                            <SelectItem key={event._id} value={event._id} className="text-white">
                                                {event.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-gray-300">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 h-12"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-gray-300">Phone Number</Label>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="9876543210"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 h-12"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Ticket downloaded successfully!
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold text-lg shadow-lg shadow-green-500/25 transition-all"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Downloading...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download Ticket
                                </span>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
