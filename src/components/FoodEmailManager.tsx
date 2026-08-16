'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingFrame } from '@/components/dot-matrix';
import { BoxyFrame } from '@/components/boxy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BackToEvent, headerActionCell, headerStatCell } from '@/components/back-to-event';
import { useToast } from '@/hooks/use-toast';

// The colour mail run. Same machinery as the ticket send — an SSE stream, an invocation
// cap on Vercel, and a status field on the row so an interrupted run resumes rather than
// starting over or double-sending.

interface Session {
    _id: string;
    color: string;
    colorName: string;
    colorHex: string;
    timing: string;
    count: number;
}

interface Assignment {
    _id: string;
    name: string;
    regNo: string;
    email: string;
    sessionId: string;
    colorName: string;
    colorHex: string;
    emailStatus: 'pending' | 'sent' | 'failed';
}

interface AssignmentsResponse {
    sessions: Session[];
    assignments: Assignment[];
}

interface SentRecord {
    name: string;
    regNo: string;
    email: string;
    color: string;
    status: 'sent' | 'failed';
    error?: string;
}

async function fetchAssignments(eventId: string): Promise<AssignmentsResponse> {
    const res = await fetch(`/api/events/${eventId}/food-assignments`);
    if (!res.ok) throw new Error('Failed to load food assignments');
    return res.json();
}

export function FoodEmailManager({ eventId, eventTitle = '' }: { eventId: string; eventTitle?: string }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [templateLoaded, setTemplateLoaded] = useState(false);
    const [savingTemplate, setSavingTemplate] = useState(false);

    const [sessionFilter, setSessionFilter] = useState('');
    const [intervalSeconds, setIntervalSeconds] = useState(1);
    const [isSending, setIsSending] = useState(false);
    const [progress, setProgress] = useState({ processed: 0, total: 0, sent: 0, failed: 0 });
    const [records, setRecords] = useState<SentRecord[]>([]);
    const [capNotice, setCapNotice] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['food-assignments', eventId],
        queryFn: () => fetchAssignments(eventId),
    });

    useEffect(() => {
        (async () => {
            const res = await fetch(`/api/food-emails/template?eventId=${eventId}`);
            if (!res.ok) return;
            const t = await res.json();
            setSubject(t.subject ?? '');
            setBody(t.body ?? '');
            setTemplateLoaded(true);
        })();
    }, [eventId]);

    const sessions = data?.sessions ?? [];
    const assignments = useMemo(
        () => (data?.assignments ?? []).filter((a) => !sessionFilter || a.sessionId === sessionFilter),
        [data, sessionFilter]
    );

    const pending = assignments.filter((a) => a.emailStatus !== 'sent');
    const sentCount = assignments.length - pending.length;

    async function saveTemplate() {
        setSavingTemplate(true);
        try {
            const res = await fetch('/api/food-emails/template', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, subject, body }),
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
            toast({ title: 'Template Saved' });
        } catch (e) {
            toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
        } finally {
            setSavingTemplate(false);
        }
    }

    async function send(payload: Record<string, unknown>) {
        setIsSending(true);
        setCapNotice(null);
        setProgress({ processed: 0, total: 0, sent: 0, failed: 0 });
        setRecords([]);

        try {
            const res = await fetch('/api/food-emails/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId,
                    sessionId: sessionFilter || undefined,
                    batchSize: 1,
                    delayMs: intervalSeconds * 1000,
                    ...payload,
                }),
            });

            if (!res.ok) throw new Error((await res.json()).error || 'Failed to send');

            const reader = res.body?.getReader();
            if (!reader) throw new Error('Stream not available');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const chunks = buffer.split('\n\n');
                buffer = chunks.pop() || '';

                for (const chunk of chunks) {
                    const line = chunk.replace(/^data: /, '').trim();
                    if (!line) continue;
                    const evt = JSON.parse(line);

                    if (evt.type === 'progress') {
                        setProgress({
                            processed: evt.data.processed,
                            total: evt.data.total,
                            sent: evt.data.sent,
                            failed: evt.data.failed,
                        });
                        setRecords((prev) => [...prev, ...evt.data.records]);
                    } else if (evt.type === 'complete') {
                        setProgress((p) => ({ ...p, sent: evt.data.sent, failed: evt.data.failed }));
                        if (evt.data.capped) {
                            setCapNotice(
                                `Stopped at the ${evt.data.batchLimit} per-run limit. ${evt.data.remaining} still to send — press Send again.`
                            );
                        }
                    } else if (evt.type === 'error') {
                        throw new Error(evt.data.message);
                    }
                }
            }

            queryClient.invalidateQueries({ queryKey: ['food-assignments', eventId] });
        } catch (e) {
            toast({ title: 'Send Failed', description: (e as Error).message, variant: 'destructive' });
        } finally {
            setIsSending(false);
        }
    }

    const percent = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

    return (
        <div className="space-y-5">
            <BoxyFrame className="bg-card/40">
                <div className="p-5">
                    <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
                        Food Colour Mailing
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Tells each checked-in attendee which colour they were given
                        {eventTitle ? ` for ${eventTitle}` : ''}. Only people holding a slot are mailed.
                    </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-border -ml-px">
                    <BackToEvent eventId={eventId} label="Back to Overview" className={headerActionCell} />
                    <div className={headerStatCell}>
                        <span className="text-muted-foreground">Assigned :</span>
                        <span className="font-bold text-foreground tabular-nums">{assignments.length}</span>
                    </div>
                    <div className={headerStatCell}>
                        <span className="text-muted-foreground">Mailed :</span>
                        <span className="font-bold text-foreground tabular-nums">{sentCount}</span>
                    </div>
                    <div className={headerStatCell}>
                        <span className="text-muted-foreground">To send :</span>
                        <span className="font-bold text-foreground tabular-nums">{pending.length}</span>
                    </div>
                </div>
            </BoxyFrame>

            {/* Template — same shape as the ticket email template */}
            <BoxyFrame className="bg-card/40 p-5 space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Template</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        Placeholders: <code>{'{{name}}'}</code> <code>{'{{regNo}}'}</code>{' '}
                        <code>{'{{eventTitle}}'}</code> <code>{'{{date}}'}</code> <code>{'{{color}}'}</code>{' '}
                        <code>{'{{timing}}'}</code>. The colour block and sitting time are added below your
                        text automatically.
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="fe-subject">Subject</Label>
                    <Input
                        id="fe-subject"
                        className="bg-card border-border text-foreground"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={!templateLoaded}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="fe-body">Body</Label>
                    <textarea
                        id="fe-body"
                        rows={5}
                        className="w-full bg-card border border-border text-foreground text-sm p-3 rounded-none focus:outline-none focus:ring-1 focus:ring-foreground"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        disabled={!templateLoaded}
                    />
                </div>
                <div className="flex justify-end">
                    <Button size="sm" onClick={saveTemplate} disabled={savingTemplate || !templateLoaded}>
                        {savingTemplate ? 'Saving…' : 'Save Template'}
                    </Button>
                </div>
            </BoxyFrame>

            {/* Send controls */}
            <BoxyFrame className="bg-card/40 p-5 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Send</h2>

                <div className="flex flex-wrap gap-2 items-center">
                    <button
                        type="button"
                        onClick={() => setSessionFilter('')}
                        className={`px-3 py-1.5 text-xs border transition-colors ${
                            sessionFilter === '' ? 'border-foreground text-foreground' : 'border-border text-muted-foreground'
                        }`}
                    >
                        All colours
                    </button>
                    {sessions.map((s) => (
                        <button
                            key={s._id}
                            type="button"
                            onClick={() => setSessionFilter(sessionFilter === s._id ? '' : s._id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors ${
                                sessionFilter === s._id ? 'border-foreground text-foreground' : 'border-border text-muted-foreground'
                            }`}
                        >
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.colorHex }} />
                            {s.colorName}
                            {s.timing && <span className="opacity-60">· {s.timing}</span>}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="fe-interval">Seconds between emails</Label>
                        <Input
                            id="fe-interval"
                            type="number"
                            min={1}
                            max={5}
                            className="bg-card border-border text-foreground w-32"
                            value={intervalSeconds}
                            onChange={(e) => setIntervalSeconds(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                        />
                    </div>
                    <Button onClick={() => send({})} disabled={isSending || pending.length === 0}>
                        {isSending ? 'Sending…' : `Send to ${pending.length} pending`}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => send({ resend: true })}
                        disabled={isSending || assignments.length === 0}
                    >
                        Resend to all {assignments.length}
                    </Button>
                </div>

                {capNotice && (
                    <p className="text-sm text-orange-300 border border-orange-300/30 bg-orange-300/10 p-3">
                        {capNotice}
                    </p>
                )}

                {(isSending || progress.total > 0) && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm text-muted-foreground tabular-nums">
                            <span>
                                {progress.processed} / {progress.total}
                            </span>
                            <span>
                                <span className="text-emerald-300">{progress.sent} sent</span>
                                {progress.failed > 0 && <span className="text-rose-300"> · {progress.failed} failed</span>}
                            </span>
                        </div>
                        <div className="w-full bg-muted h-2 overflow-hidden">
                            <div className="h-full bg-foreground transition-all" style={{ width: `${percent}%` }} />
                        </div>
                    </div>
                )}
            </BoxyFrame>

            {/* Recipients */}
            <BoxyFrame className="bg-card/40">
                <div className="p-5 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground">Recipients</h2>
                </div>
                {isLoading ? (
                    <div className="py-8">
                        <LoadingFrame label="Loading" />
                    </div>
                ) : assignments.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-10">
                        Nobody has been given a colour yet.
                    </p>
                ) : (
                    <div className="divide-y divide-border max-h-[26rem] overflow-auto thin-scroll">
                        {assignments.map((a) => {
                            const live = records.find((r) => r.email === a.email);
                            const status = live?.status ?? a.emailStatus;
                            return (
                                <div key={a._id} className="flex items-center gap-3 px-5 py-3">
                                    <span
                                        className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-white/20"
                                        style={{ backgroundColor: a.colorHex }}
                                        title={a.colorName}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-foreground truncate">{a.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {a.regNo} · {a.email}
                                        </p>
                                    </div>
                                    {status === 'sent' ? (
                                        <Badge variant="success">Sent</Badge>
                                    ) : status === 'failed' ? (
                                        <Badge variant="destructive" title={live?.error}>Failed</Badge>
                                    ) : (
                                        <Badge variant="secondary">Pending</Badge>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </BoxyFrame>
        </div>
    );
}
