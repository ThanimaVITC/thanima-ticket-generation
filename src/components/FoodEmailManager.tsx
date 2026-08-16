'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingFrame } from '@/components/dot-matrix';
import { BoxyFrame } from '@/components/boxy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BackLink, headerActionCell, headerStatCell } from '@/components/back-to-event';
import { useToast } from '@/hooks/use-toast';
import {
    buildFoodColorEmailHtml,
    withFoodEmailDefaults,
    COLOR_BOX_TOKEN,
    type FoodEmailTemplate,
} from '@/lib/email-templates';

// The colour mail run. Same machinery as the ticket send — an SSE stream, an invocation
// cap on Vercel, and a status field on the row so an interrupted run resumes rather than
// starting over or double-sending.
//
// Two panes: who is still owed a mail on the left, what they will receive on the right.

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

type ListFilter = 'pending' | 'sent' | 'all';

async function fetchAssignments(eventId: string): Promise<AssignmentsResponse> {
    const res = await fetch(`/api/events/${eventId}/food-assignments`);
    if (!res.ok) throw new Error('Failed to load food assignments');
    return res.json();
}

export function FoodEmailManager({ eventId, eventTitle = '' }: { eventId: string; eventTitle?: string }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [tpl, setTpl] = useState<FoodEmailTemplate>(withFoodEmailDefaults(null));
    const [templateLoaded, setTemplateLoaded] = useState(false);
    const setField = (k: keyof FoodEmailTemplate) => (v: string) =>
        setTpl((prev) => ({ ...prev, [k]: v }));
    const [savingTemplate, setSavingTemplate] = useState(false);

    const [sessionFilter, setSessionFilter] = useState('');
    const [listFilter, setListFilter] = useState<ListFilter>('pending');
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
            setTpl(withFoodEmailDefaults(await res.json()));
            setTemplateLoaded(true);
        })();
    }, [eventId]);

    const sessions = data?.sessions ?? [];
    const all = data?.assignments ?? [];

    const inScope = useMemo(
        () => all.filter((a) => !sessionFilter || a.sessionId === sessionFilter),
        [all, sessionFilter]
    );

    const pending = inScope.filter((a) => a.emailStatus !== 'sent');
    const sent = inScope.filter((a) => a.emailStatus === 'sent');

    const listed =
        listFilter === 'pending' ? pending : listFilter === 'sent' ? sent : inScope;

    // Preview against a real recipient where possible — a name in the greeting reads very
    // differently from a placeholder, and it catches a broken {{name}} immediately.
    const previewSession =
        sessions.find((s) => s._id === sessionFilter) ?? sessions[0] ?? null;
    const previewPerson = pending[0] ?? inScope[0] ?? null;

    const previewHtml = useMemo(() => {
        if (!previewSession) return '';
        const vars = {
            name: previewPerson?.name || 'Aravind K',
            regNo: previewPerson?.regNo || '22BCS118',
            eventTitle: eventTitle || 'the event',
            date: new Date().toLocaleDateString(undefined, { dateStyle: 'long' }),
            color: previewSession.colorName,
            timing: previewSession.timing,
        };
        return buildFoodColorEmailHtml({
            template: tpl,
            variables: vars,
            colorName: previewSession.colorName,
            colorHex: previewSession.colorHex,
        });
    }, [tpl, previewSession, previewPerson, eventTitle]);

    async function saveTemplate() {
        setSavingTemplate(true);
        try {
            const res = await fetch('/api/food-emails/template', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, ...tpl }),
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
    const listTab = (key: ListFilter, label: string, n: number) => (
        <button
            key={key}
            type="button"
            onClick={() => setListFilter(key)}
            className={`px-3 py-1.5 text-xs border transition-colors ${
                listFilter === key ? 'border-foreground text-foreground' : 'border-border text-muted-foreground'
            }`}
        >
            {label} · {n}
        </button>
    );

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
                {/* Two levels deep, so the whole trail is offered rather than making
                    staff walk back up one page at a time. */}
                <div className="grid grid-cols-1 sm:grid-cols-3 border-t border-border -ml-px">
                    <BackLink href="/dashboard" label="Back to Events" className={headerActionCell} />
                    <BackLink
                        href={`/dashboard/events/${eventId}`}
                        label="Back to Overview"
                        className={headerActionCell}
                    />
                    <BackLink
                        href={`/dashboard/events/${eventId}/food-sessions`}
                        label="Back to Food Sessions"
                        className={headerActionCell}
                    />
                </div>
                <div className="grid grid-cols-3 border-t border-border -ml-px">
                    <div className={headerStatCell}>
                        <span className="text-muted-foreground">Assigned :</span>
                        <span className="font-bold text-foreground tabular-nums">{inScope.length}</span>
                    </div>
                    <div className={headerStatCell}>
                        <span className="text-muted-foreground">Mailed :</span>
                        <span className="font-bold text-foreground tabular-nums">{sent.length}</span>
                    </div>
                    <div className={headerStatCell}>
                        <span className="text-muted-foreground">To send :</span>
                        <span className="font-bold text-foreground tabular-nums">{pending.length}</span>
                    </div>
                </div>
            </BoxyFrame>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {/* ---------------------------------------------------------- left: recipients */}
                <BoxyFrame className="bg-card/40">
                    <div className="p-5 border-b border-border space-y-3">
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">Recipients</h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                Everyone holding a colour. Sending covers whichever colour is selected below.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {listTab('pending', 'Yet to send', pending.length)}
                            {listTab('sent', 'Sent', sent.length)}
                            {listTab('all', 'All', inScope.length)}
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
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
                                </button>
                            ))}
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="py-10">
                            <LoadingFrame label="Loading" />
                        </div>
                    ) : listed.length === 0 ? (
                        <p className="text-muted-foreground text-sm text-center py-12">
                            {listFilter === 'pending'
                                ? inScope.length === 0
                                    ? 'Nobody has been given a colour yet.'
                                    : 'Everyone here has been mailed.'
                                : 'Nothing to show.'}
                        </p>
                    ) : (
                        <div className="divide-y divide-border max-h-[34rem] overflow-auto thin-scroll">
                            {listed.map((a) => {
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

                {/* --------------------------------------- right: template, preview, settings */}
                <div className="space-y-5">
                    <BoxyFrame className="bg-card/40 p-5 space-y-4">
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">Template</h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                Placeholders: <code>{'{{name}}'}</code> <code>{'{{regNo}}'}</code>{' '}
                                <code>{'{{eventTitle}}'}</code> <code>{'{{date}}'}</code>{' '}
                                <code>{'{{color}}'}</code> <code>{'{{timing}}'}</code>, and{' '}
                                <code>{COLOR_BOX_TOKEN}</code> on its own line for the colour block.
                                A line using <code>{'{{timing}}'}</code> is dropped when that session has
                                no time set.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fe-subject">Subject line</Label>
                            <Input
                                id="fe-subject"
                                className="bg-card border-border text-foreground"
                                value={tpl.subject}
                                onChange={(e) => setField('subject')(e.target.value)}
                                disabled={!templateLoaded}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="fe-heading">Heading</Label>
                            <Input
                                id="fe-heading"
                                placeholder="Leave blank to drop the heading bar"
                                className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                                value={tpl.heading}
                                onChange={(e) => setField('heading')(e.target.value)}
                                disabled={!templateLoaded}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <Label htmlFor="fe-body">Body</Label>
                                <button
                                    type="button"
                                    disabled={!templateLoaded || tpl.body.includes(COLOR_BOX_TOKEN)}
                                    onClick={() =>
                                        setField('body')(`${tpl.body.replace(/\s*$/, '')}\n\n${COLOR_BOX_TOKEN}\n`)
                                    }
                                    className="text-xs text-foreground underline underline-offset-4 hover:opacity-80 disabled:opacity-30 disabled:no-underline"
                                >
                                    {tpl.body.includes(COLOR_BOX_TOKEN) ? 'Colour box placed' : 'Insert colour box'}
                                </button>
                            </div>
                            <textarea
                                id="fe-body"
                                rows={10}
                                className="w-full bg-card border border-border text-foreground text-sm p-3 font-mono focus:outline-none focus:ring-1 focus:ring-foreground"
                                value={tpl.body}
                                onChange={(e) => setField('body')(e.target.value)}
                                disabled={!templateLoaded}
                            />
                            {!tpl.body.includes(COLOR_BOX_TOKEN) && templateLoaded && (
                                <p className="text-xs text-orange-300">
                                    No <code>{COLOR_BOX_TOKEN}</code> in the body — the email will not show
                                    the colour at all.
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fe-boxlabel">Colour box caption</Label>
                                <Input
                                    id="fe-boxlabel"
                                    className="bg-card border-border text-foreground"
                                    value={tpl.colorBoxLabel}
                                    onChange={(e) => setField('colorBoxLabel')(e.target.value)}
                                    disabled={!templateLoaded}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="fe-footer">Footer note</Label>
                                <Input
                                    id="fe-footer"
                                    placeholder="Leave blank to drop the footer"
                                    className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                                    value={tpl.footer}
                                    onChange={(e) => setField('footer')(e.target.value)}
                                    disabled={!templateLoaded}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button size="sm" onClick={saveTemplate} disabled={savingTemplate || !templateLoaded}>
                                {savingTemplate ? 'Saving…' : 'Save Template'}
                            </Button>
                        </div>
                    </BoxyFrame>

                    <BoxyFrame className="bg-card/40">
                        <div className="p-5 border-b border-border">
                            <h2 className="text-lg font-semibold text-foreground">Preview</h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                {previewSession
                                    ? <>Rendered as {previewPerson?.name ?? 'a sample attendee'} would receive it, in {previewSession.colorName}. Pick a colour on the left to preview another.</>
                                    : 'Add a food session to see the preview.'}
                            </p>
                        </div>
                        {previewSession ? (
                            <iframe
                                title="Email preview"
                                // sandbox with no allow-* tokens: the preview renders but can run nothing.
                                sandbox=""
                                srcDoc={previewHtml}
                                className="w-full h-[520px] bg-white border-0"
                            />
                        ) : (
                            <p className="text-muted-foreground text-sm text-center py-12">No sessions yet.</p>
                        )}
                    </BoxyFrame>

                    <BoxyFrame className="bg-card/40 p-5 space-y-4">
                        <h2 className="text-lg font-semibold text-foreground">Send</h2>

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
                                    onChange={(e) =>
                                        setIntervalSeconds(Math.max(1, Math.min(5, Number(e.target.value) || 1)))
                                    }
                                />
                            </div>
                            <Button onClick={() => send({})} disabled={isSending || pending.length === 0}>
                                {isSending ? 'Sending…' : `Send to ${pending.length} pending`}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => send({ resend: true })}
                                disabled={isSending || inScope.length === 0}
                            >
                                Resend all {inScope.length}
                            </Button>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            {sessionFilter
                                ? `Sending is limited to ${sessions.find((s) => s._id === sessionFilter)?.colorName ?? 'the selected colour'}.`
                                : 'Sending covers every colour.'}
                        </p>

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
                                        {progress.failed > 0 && (
                                            <span className="text-rose-300"> · {progress.failed} failed</span>
                                        )}
                                    </span>
                                </div>
                                <div className="w-full bg-muted h-2 overflow-hidden">
                                    <div className="h-full bg-foreground transition-all" style={{ width: `${percent}%` }} />
                                </div>
                            </div>
                        )}
                    </BoxyFrame>
                </div>
            </div>
        </div>
    );
}
