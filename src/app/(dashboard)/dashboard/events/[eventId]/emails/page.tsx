'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2, Mail, Send, Settings, TestTube, ArrowLeft, Clock, Zap } from 'lucide-react';

interface Registration {
    _id: string;
    eventId: string;
    name: string;
    regNo: string;
    email: string;
    phone: string;
    downloadCount: number;
    createdAt: string;
    attended: boolean;
    attendance: { markedAt: string; source: 'web' | 'mobile' } | null;
    qrPayload?: string | null;
    emailSentAt?: string | null;
    emailStatus?: 'pending' | 'sent' | 'failed';
}

interface Event {
    _id: string;
    title: string;
    description: string;
    date: string;
    isPublicDownload: boolean;
    ticketTemplate?: {
        imagePath?: string;
        qrPosition?: { x: number; y: number; width: number; height: number };
        namePosition?: { x: number; y: number; fontSize: number; color: string };
    };
    createdAt: string;
}

interface EventDetailResponse {
    event: Event;
    registrations: Registration[];
    stats: {
        totalRegistrations: number;
        totalAttendance: number;
        attendanceRate: number;
    };
}

interface ProcessedRecord {
    name: string;
    regNo: string;
    email: string;
    status: 'sent' | 'failed';
    error?: string;
}

interface SendProgress {
    processed: number;
    total: number;
    sent: number;
    failed: number;
    records: ProcessedRecord[];
}

async function fetchEventDetail(eventId: string): Promise<EventDetailResponse> {
    const res = await fetch(`/api/events/${eventId}`);
    if (!res.ok) throw new Error('Failed to fetch event');
    return res.json();
}

export default function EmailsPage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const { eventId } = use(params);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Template state
    const [emailSubject, setEmailSubject] = useState('Your Ticket for {{eventTitle}}');
    const [emailBody, setEmailBody] = useState('Hi {{name}},\n\nHere is your ticket for {{eventTitle}} on {{date}}.\n\nYour registration number is {{regNo}}.\n\nPlease present the QR code on your ticket at the event for entry.\n\nSee you there!');
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [templateLoaded, setTemplateLoaded] = useState(false);
    // Track what's saved on the server to detect unsaved edits
    const savedSubjectRef = useRef(emailSubject);
    const savedBodyRef = useRef(emailBody);

    // Test email state
    const [testEmail, setTestEmail] = useState('');
    const [isSendingTest, setIsSendingTest] = useState(false);

    // Send controls state — simplified
    const [emailCount, setEmailCount] = useState(10);
    const [intervalSeconds, setIntervalSeconds] = useState(2);

    // Progress state
    const [isSending, setIsSending] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [progress, setProgress] = useState<SendProgress>({
        processed: 0, total: 0, sent: 0, failed: 0, records: [],
    });
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsed, setElapsed] = useState(0);

    const feedRef = useRef<HTMLDivElement>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ['event', eventId],
        queryFn: () => fetchEventDetail(eventId),
    });

    // Auto-scroll feed
    useEffect(() => {
        if (feedRef.current) {
            feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
    }, [progress.records]);

    // Elapsed time counter
    useEffect(() => {
        if (!startTime || isComplete) return;
        const timer = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [startTime, isComplete]);

    // Load email template on mount
    useEffect(() => {
        async function loadTemplate() {
            try {
                const res = await fetch(`/api/emails/template?eventId=${eventId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.subject) {
                        setEmailSubject(data.subject);
                        savedSubjectRef.current = data.subject;
                    }
                    if (data.body) {
                        setEmailBody(data.body);
                        savedBodyRef.current = data.body;
                    }
                }
            } catch {
                // Use defaults
            } finally {
                setTemplateLoaded(true);
            }
        }
        loadTemplate();
    }, [eventId]);

    const registrations = data?.registrations ?? [];
    const event = data?.event;

    // Compute stats
    const totalRegistrations = registrations.length;
    const sentCount = registrations.filter(r => r.emailStatus === 'sent').length;
    const failedCount = registrations.filter(r => r.emailStatus === 'failed').length;
    const pendingCount = totalRegistrations - sentCount;

    // Selection helpers
    const allSelected = registrations.length > 0 && registrations.every(r => selectedIds.has(r._id));

    function toggleAll() {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(registrations.map(r => r._id)));
        }
    }

    function toggleOne(id: string) {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    }

    async function handleSaveTemplate() {
        setIsSavingTemplate(true);
        try {
            const res = await fetch('/api/emails/template', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, subject: emailSubject, body: emailBody }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to save template');
            }
            savedSubjectRef.current = emailSubject;
            savedBodyRef.current = emailBody;
            toast({ title: 'Template Saved' });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSavingTemplate(false);
        }
    }

    const hasUnsavedTemplate = emailSubject !== savedSubjectRef.current || emailBody !== savedBodyRef.current;

    async function handleSendTestEmail() {
        if (!testEmail) return;
        setIsSendingTest(true);
        try {
            const res = await fetch('/api/emails/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: testEmail }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send test email');
            toast({ title: 'Test Email Sent', description: `Sent to ${testEmail}` });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSendingTest(false);
        }
    }

    async function startSending(payload: {
        registrationIds?: string[];
        count?: number;
    }) {
        setIsSending(true);
        setIsComplete(false);
        setProgress({ processed: 0, total: 0, sent: 0, failed: 0, records: [] });
        setStartTime(Date.now());
        setElapsed(0);

        try {
            // Don't pass emailSubject/emailBody — the API will use the
            // event's saved template (event.emailTemplate.subject/body)
            const res = await fetch('/api/emails/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId,
                    ...payload,
                    batchSize: 1,
                    delayMs: intervalSeconds * 1000,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to send emails');
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('Stream not available');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const dataLine = line.replace(/^data: /, '').trim();
                    if (!dataLine) continue;

                    try {
                        const sseEvent = JSON.parse(dataLine);

                        if (sseEvent.type === 'progress') {
                            setProgress(prev => ({
                                processed: sseEvent.data.processed,
                                total: sseEvent.data.total,
                                sent: sseEvent.data.sent,
                                failed: sseEvent.data.failed,
                                records: [...prev.records, ...sseEvent.data.records],
                            }));
                        } else if (sseEvent.type === 'complete') {
                            setIsComplete(true);
                            setProgress(prev => ({
                                ...prev,
                                processed: sseEvent.data.total,
                                sent: sseEvent.data.sent,
                                failed: sseEvent.data.failed,
                            }));
                        } else if (sseEvent.type === 'error') {
                            throw new Error(sseEvent.data.message);
                        }
                    } catch (parseError: any) {
                        if (parseError.message && parseError.message !== 'Unexpected token') throw parseError;
                    }
                }
            }

            queryClient.invalidateQueries({ queryKey: ['event', eventId] });
        } catch (error: any) {
            toast({ title: 'Email Send Failed', description: error.message, variant: 'destructive' });
        } finally {
            if (!isComplete) setIsSending(false);
        }
    }

    function handleStartSending() {
        startSending({ count: emailCount });
    }

    function handleSendSelected() {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) {
            toast({ title: 'No Selection', description: 'Please select registrations from the table', variant: 'destructive' });
            return;
        }
        startSending({ registrationIds: ids });
    }

    function resetProgress() {
        setIsSending(false);
        setIsComplete(false);
        setProgress({ processed: 0, total: 0, sent: 0, failed: 0, records: [] });
        setStartTime(null);
        setElapsed(0);
        queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    }

    const progressPercentage = progress.total > 0
        ? Math.round((progress.processed / progress.total) * 100)
        : 0;

    // Format seconds to mm:ss
    function formatTime(seconds: number) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    // Estimate remaining time
    const etaSeconds = progress.processed > 0 && progress.total > 0 && !isComplete
        ? Math.round((elapsed / progress.processed) * (progress.total - progress.processed))
        : 0;

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-12 h-12 relative">
                    <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="text-center py-20">
                <p className="text-red-400">Failed to load event</p>
                <Link href="/dashboard">
                    <Button className="mt-4">Back to Events</Button>
                </Link>
            </div>
        );
    }

    // ──── Progress / Sending Overlay ────
    if (isSending || isComplete) {
        const circumference = 2 * Math.PI * 54;
        const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

        return (
            <div className="space-y-6">
                <style jsx>{`
                    @keyframes fadeSlideUp {
                        from { opacity: 0; transform: translateY(12px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes pulse-glow {
                        0%, 100% { box-shadow: 0 0 8px rgba(168, 85, 247, 0.3); }
                        50% { box-shadow: 0 0 24px rgba(168, 85, 247, 0.6); }
                    }
                    @keyframes shimmer {
                        0% { background-position: -200% 0; }
                        100% { background-position: 200% 0; }
                    }
                    @keyframes countUp {
                        from { opacity: 0; transform: scale(0.5); }
                        to { opacity: 1; transform: scale(1); }
                    }
                    @keyframes checkBounce {
                        0% { transform: scale(0); }
                        50% { transform: scale(1.2); }
                        100% { transform: scale(1); }
                    }
                    @keyframes confettiFloat {
                        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                        100% { transform: translateY(-40px) rotate(360deg); opacity: 0; }
                    }
                    .email-record-enter {
                        animation: fadeSlideUp 0.35s ease-out forwards;
                        opacity: 0;
                    }
                    .email-progress-glow { animation: pulse-glow 2s ease-in-out infinite; }
                    .email-progress-shimmer {
                        background: linear-gradient(90deg, rgba(168,85,247,0.8) 0%, rgba(192,132,252,1) 50%, rgba(168,85,247,0.8) 100%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s linear infinite;
                    }
                    .stat-count-enter { animation: countUp 0.3s ease-out; }
                    .check-bounce { animation: checkBounce 0.5s ease-out; }
                    .confetti-particle { animation: confettiFloat 1.5s ease-out forwards; }
                `}</style>

                {/* Header with live indicator */}
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            {isComplete ? (
                                <>
                                    <span className="check-bounce inline-flex">
                                        <CheckCircle className="h-7 w-7 text-green-400" />
                                    </span>
                                    All Done!
                                </>
                            ) : (
                                <>
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                                    </span>
                                    Sending Emails
                                </>
                            )}
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">
                            {isComplete
                                ? `Completed in ${formatTime(elapsed)}`
                                : `${progress.processed} of ${progress.total} processed`
                            }
                        </p>
                    </div>
                    {!isComplete && (
                        <div className="flex items-center gap-2 text-sm text-gray-400 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="font-mono tabular-nums">{formatTime(elapsed)}</span>
                            {etaSeconds > 0 && (
                                <span className="text-gray-500 ml-1">/ ~{formatTime(etaSeconds)} left</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Circular progress + stats */}
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        {/* Circular Progress Ring */}
                        <div className="relative shrink-0">
                            <svg width="140" height="140" className="transform -rotate-90">
                                <circle
                                    cx="70" cy="70" r="54"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.05)"
                                    strokeWidth="10"
                                />
                                <circle
                                    cx="70" cy="70" r="54"
                                    fill="none"
                                    stroke={isComplete ? '#22c55e' : 'url(#progressGradient)'}
                                    strokeWidth="10"
                                    strokeLinecap="round"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    className="transition-all duration-700 ease-out"
                                    style={{ filter: isComplete ? 'none' : 'drop-shadow(0 0 6px rgba(168,85,247,0.5))' }}
                                />
                                <defs>
                                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#a855f7" />
                                        <stop offset="100%" stopColor="#c084fc" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold text-white tabular-nums stat-count-enter" key={progressPercentage}>
                                    {progressPercentage}%
                                </span>
                                {!isComplete && (
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Sending</span>
                                )}
                            </div>
                            {/* Completion confetti dots */}
                            {isComplete && (
                                <div className="absolute inset-0 pointer-events-none">
                                    {[...Array(8)].map((_, i) => (
                                        <span
                                            key={i}
                                            className="confetti-particle absolute w-1.5 h-1.5 rounded-full"
                                            style={{
                                                left: `${50 + 40 * Math.cos((i * Math.PI * 2) / 8)}%`,
                                                top: `${50 + 40 * Math.sin((i * Math.PI * 2) / 8)}%`,
                                                background: ['#a855f7', '#22c55e', '#3b82f6', '#eab308'][i % 4],
                                                animationDelay: `${i * 100}ms`,
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Stats Grid */}
                        <div className="flex-1 grid grid-cols-3 gap-3 w-full">
                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                                <p className="text-3xl font-bold text-green-400 tabular-nums stat-count-enter" key={`s-${progress.sent}`}>
                                    {progress.sent}
                                </p>
                                <p className="text-xs text-green-300/70 mt-1 flex items-center justify-center gap-1">
                                    <CheckCircle className="h-3 w-3" /> Sent
                                </p>
                            </div>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                                <p className="text-3xl font-bold text-red-400 tabular-nums stat-count-enter" key={`f-${progress.failed}`}>
                                    {progress.failed}
                                </p>
                                <p className="text-xs text-red-300/70 mt-1 flex items-center justify-center gap-1">
                                    <XCircle className="h-3 w-3" /> Failed
                                </p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                <p className="text-3xl font-bold text-white tabular-nums">
                                    {progress.processed}<span className="text-gray-500 text-lg">/{progress.total}</span>
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Processed</p>
                            </div>
                        </div>
                    </div>

                    {/* Linear progress bar */}
                    <div className="mt-6 space-y-1.5">
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden email-progress-glow">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ease-out ${isComplete ? 'bg-green-500' : 'email-progress-shimmer'}`}
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Live Feed */}
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                            <Zap className="h-4 w-4 text-purple-400" />
                            Live Feed
                        </h3>
                        {!isComplete && (
                            <span className="flex items-center gap-1.5 text-xs text-purple-300">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400"></span>
                                </span>
                                Live
                            </span>
                        )}
                    </div>
                    <div ref={feedRef} className="max-h-[350px] overflow-y-auto">
                        <Table>
                            <TableHeader className="bg-white/5 sticky top-0 z-10">
                                <TableRow className="border-white/10">
                                    <TableHead className="text-gray-400 w-10">#</TableHead>
                                    <TableHead className="text-gray-400">Name</TableHead>
                                    <TableHead className="text-gray-400">Email</TableHead>
                                    <TableHead className="text-gray-400 text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {progress.records.map((record, i) => (
                                    <TableRow
                                        key={i}
                                        className="border-white/10 email-record-enter"
                                        style={{ animationDelay: `${(i % 5) * 60}ms` }}
                                    >
                                        <TableCell className="text-gray-600 font-mono text-xs tabular-nums">{i + 1}</TableCell>
                                        <TableCell className="font-medium text-white text-sm">{record.name}</TableCell>
                                        <TableCell className="text-gray-400 text-sm">{record.email}</TableCell>
                                        <TableCell className="text-right">
                                            {record.status === 'sent' ? (
                                                <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30 gap-1">
                                                    <CheckCircle className="h-3 w-3" /> Sent
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30 gap-1">
                                                    <XCircle className="h-3 w-3" /> Failed
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {progress.records.length === 0 && !isComplete && (
                                    <TableRow className="border-white/10">
                                        <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                                            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-purple-400" />
                                            <span className="text-sm">Preparing emails...</span>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {!isComplete && progress.records.length > 0 && (
                                    <>
                                        {[...Array(2)].map((_, i) => (
                                            <TableRow key={`skel-${i}`} className="border-white/10">
                                                <TableCell colSpan={4}>
                                                    <div className="h-4 bg-white/5 rounded animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Done button */}
                {isComplete && (
                    <div className="flex justify-end">
                        <Button onClick={resetProgress} className="bg-purple-600 hover:bg-purple-700 px-8">
                            Done
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    if (!templateLoaded) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-12 h-12 relative">
                    <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                </div>
            </div>
        );
    }

    // ──── Main View ────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <Link
                            href={`/dashboard/events/${eventId}/registrations`}
                            className="text-gray-500 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <h2 className="text-2xl font-bold text-white">Email Distribution</h2>
                    </div>
                    <p className="text-gray-400 text-sm ml-8">{event?.title}</p>
                </div>
                <Button
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['event', eventId] })}
                >
                    <span className="mr-2">&#8635;</span> Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white tabular-nums">{totalRegistrations}</p>
                    <p className="text-xs text-gray-400 mt-1">Total</p>
                </div>
                <div className="bg-gradient-to-b from-green-500/10 to-transparent border border-green-500/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-400 tabular-nums">{sentCount}</p>
                    <p className="text-xs text-green-300/70 mt-1">Sent</p>
                </div>
                <div className="bg-gradient-to-b from-yellow-500/10 to-transparent border border-yellow-500/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-400 tabular-nums">{pendingCount}</p>
                    <p className="text-xs text-yellow-300/70 mt-1">Pending</p>
                </div>
                <div className="bg-gradient-to-b from-red-500/10 to-transparent border border-red-500/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-red-400 tabular-nums">{failedCount}</p>
                    <p className="text-xs text-red-300/70 mt-1">Failed</p>
                </div>
            </div>

            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Registrations Table */}
                <div className="lg:col-span-2 bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/10">
                        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                            <Mail className="h-4 w-4 text-purple-400" />
                            Registrations
                            {selectedIds.size > 0 && (
                                <Badge className="bg-purple-500/20 text-purple-300 ml-2">
                                    {selectedIds.size} selected
                                </Badge>
                            )}
                        </h3>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto">
                        <Table>
                            <TableHeader className="bg-white/5 sticky top-0 z-10">
                                <TableRow className="border-white/10">
                                    <TableHead className="w-10">
                                        <Checkbox
                                            checked={allSelected}
                                            onCheckedChange={toggleAll}
                                            aria-label="Select all"
                                        />
                                    </TableHead>
                                    <TableHead className="text-gray-400">Name</TableHead>
                                    <TableHead className="text-gray-400">Reg No</TableHead>
                                    <TableHead className="text-gray-400">Email</TableHead>
                                    <TableHead className="text-gray-400">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {registrations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                                            No registrations found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    registrations.map((reg) => (
                                        <TableRow key={reg._id} className="border-white/10">
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedIds.has(reg._id)}
                                                    onCheckedChange={() => toggleOne(reg._id)}
                                                    aria-label={`Select ${reg.name}`}
                                                />
                                            </TableCell>
                                            <TableCell className="text-white font-medium text-sm">{reg.name}</TableCell>
                                            <TableCell className="text-gray-400 font-mono text-xs">{reg.regNo}</TableCell>
                                            <TableCell className="text-gray-300 text-sm">{reg.email}</TableCell>
                                            <TableCell>
                                                {reg.emailStatus === 'sent' ? (
                                                    <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">
                                                        Sent
                                                    </Badge>
                                                ) : reg.emailStatus === 'failed' ? (
                                                    <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30">
                                                        Failed
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-gray-500/20 text-gray-400 hover:bg-gray-500/30">
                                                        Pending
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Right Column - Controls Sidebar */}
                <div className="space-y-4">
                    {/* Email Template */}
                    <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-4 space-y-4">
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                            <Settings className="h-4 w-4 text-purple-400" />
                            <span className="font-medium">Email Template</span>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-xs text-gray-400">Subject</label>
                                <Input
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    placeholder="Your Ticket for {{eventTitle}}"
                                    className="bg-white/5 border-white/10 text-white text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs text-gray-400">Body</label>
                                <Textarea
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    placeholder="Hi {{name}},&#10;&#10;Here is your ticket..."
                                    rows={5}
                                    className="bg-white/5 border-white/10 text-white resize-y text-sm"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                                <span>Placeholders:</span>
                                {['{{name}}', '{{eventTitle}}', '{{regNo}}', '{{date}}'].map((p) => (
                                    <code key={p} className="bg-white/5 px-1.5 py-0.5 rounded text-purple-300">{p}</code>
                                ))}
                            </div>

                            <Button
                                onClick={handleSaveTemplate}
                                disabled={isSavingTemplate}
                                variant="outline"
                                size="sm"
                                className={`w-full ${hasUnsavedTemplate
                                    ? 'border-yellow-500/40 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10'
                                    : 'border-white/20 text-gray-300 hover:text-white'
                                }`}
                            >
                                {isSavingTemplate ? 'Saving...' : hasUnsavedTemplate ? 'Save Template (unsaved changes)' : 'Save Template'}
                            </Button>
                        </div>
                    </div>

                    {/* Test SMTP */}
                    <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                            <TestTube className="h-4 w-4 text-purple-400" />
                            <span className="font-medium">Test SMTP</span>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                type="email"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                placeholder="test@example.com"
                                className="bg-white/5 border-white/10 text-white text-sm"
                            />
                            <Button
                                onClick={handleSendTestEmail}
                                disabled={isSendingTest || !testEmail}
                                variant="outline"
                                size="sm"
                                className="border-white/20 text-gray-300 hover:text-white shrink-0"
                            >
                                {isSendingTest ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    'Send'
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Send Controls — Simplified */}
                    <div className="bg-gradient-to-b from-purple-500/10 to-transparent border border-purple-500/20 rounded-2xl p-4 space-y-4">
                        <div className="flex items-center gap-2 text-sm text-white">
                            <Send className="h-4 w-4 text-purple-400" />
                            <span className="font-medium">Send Emails</span>
                        </div>

                        <p className="text-xs text-gray-400">
                            Picks the first unsent registrations and sends using the event&apos;s saved template.
                        </p>

                        {hasUnsavedTemplate && (
                            <div className="flex items-start gap-2 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-yellow-400">
                                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <span>You have unsaved template changes. Save the template first so emails use your latest edits.</span>
                            </div>
                        )}

                        {/* Number of emails */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">No. of emails</label>
                                <span className="text-sm font-mono font-bold text-purple-300 tabular-nums">{emailCount}</span>
                            </div>
                            <Slider
                                value={[emailCount]}
                                onValueChange={(v) => setEmailCount(v[0])}
                                min={1}
                                max={Math.max(pendingCount, 1)}
                                step={1}
                                className="[&_[role=slider]]:bg-purple-500"
                            />
                            <div className="flex justify-between text-[10px] text-gray-600">
                                <span>1</span>
                                <span>{pendingCount} pending</span>
                            </div>
                        </div>

                        {/* Time interval */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Interval between emails</label>
                                <span className="text-sm font-mono font-bold text-purple-300 tabular-nums">{intervalSeconds}s</span>
                            </div>
                            <Slider
                                value={[intervalSeconds]}
                                onValueChange={(v) => setIntervalSeconds(v[0])}
                                min={1}
                                max={10}
                                step={1}
                                className="[&_[role=slider]]:bg-purple-500"
                            />
                            <div className="flex justify-between text-[10px] text-gray-600">
                                <span>1s</span>
                                <span>10s</span>
                            </div>
                        </div>

                        {/* Estimated time */}
                        <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/5 rounded-lg px-3 py-2">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                                Est. time: <span className="text-gray-300 font-mono">{formatTime(emailCount * intervalSeconds)}</span>
                            </span>
                        </div>

                        {/* Start button */}
                        <Button
                            onClick={handleStartSending}
                            disabled={pendingCount === 0}
                            className="bg-purple-600 hover:bg-purple-700 w-full h-11 text-sm font-semibold"
                        >
                            <Mail className="h-4 w-4 mr-2" />
                            Start Sending ({Math.min(emailCount, pendingCount)} emails)
                        </Button>

                        {/* Send selected - secondary option */}
                        {selectedIds.size > 0 && (
                            <Button
                                onClick={handleSendSelected}
                                variant="outline"
                                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 w-full"
                            >
                                Send {selectedIds.size} Selected Instead
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
