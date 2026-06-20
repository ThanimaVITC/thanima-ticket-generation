'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LoadingFrame } from '@/components/dot-matrix';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BoxyFrame } from '@/components/boxy';
import { useToast } from '@/hooks/use-toast';

interface FoodSessionStats {
    admitted: number;
    remainingToLimit: number;
    remainingToMax: number;
    nearLimit: boolean;
    full: boolean;
}

interface FoodSession {
    _id: string;
    name: string;
    limit: number;
    maxLimit: number;
    isVisible: boolean;
    count: number;
    createdAt: string;
    stats: FoodSessionStats;
}

interface FoodSessionsResponse {
    foodSessionsEnabled: boolean;
    sessions: FoodSession[];
}

async function fetchFoodSessions(eventId: string): Promise<FoodSessionsResponse> {
    const res = await fetch(`/api/events/${eventId}/food-sessions`);
    if (!res.ok) throw new Error('Failed to fetch food sessions');
    return res.json();
}

interface SessionFormState {
    name: string;
    limit: string;
    maxLimit: string;
}

const emptyForm: SessionFormState = { name: '', limit: '', maxLimit: '' };

export function FoodSessionsManager({
    eventId,
    canManage,
}: {
    eventId: string;
    canManage: boolean;
}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editing, setEditing] = useState<FoodSession | null>(null);
    const [form, setForm] = useState<SessionFormState>(emptyForm);
    const [deleteTarget, setDeleteTarget] = useState<FoodSession | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['food-sessions', eventId],
        queryFn: () => fetchFoodSessions(eventId),
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['food-sessions', eventId] });

    const saveMutation = useMutation({
        mutationFn: async () => {
            const name = form.name.trim();
            const limit = Number(form.limit);
            const maxLimit = Number(form.maxLimit);

            if (!name) throw new Error('Session name is required');
            if (!Number.isInteger(limit) || limit < 0) throw new Error('Limit must be a non-negative whole number');
            if (!Number.isInteger(maxLimit) || maxLimit < 1) throw new Error('Max limit must be a whole number of at least 1');
            if (limit > maxLimit) throw new Error('Limit cannot exceed max limit');

            const url = editing
                ? `/api/events/${eventId}/food-sessions/${editing._id}`
                : `/api/events/${eventId}/food-sessions`;
            const res = await fetch(url, {
                method: editing ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, limit, maxLimit }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to save food session');
            }
            return res.json();
        },
        onSuccess: () => {
            invalidate();
            setIsDialogOpen(false);
            setEditing(null);
            setForm(emptyForm);
            toast({ title: editing ? 'Food Session Updated' : 'Food Session Created' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const visibilityMutation = useMutation({
        mutationFn: async ({ id, isVisible }: { id: string; isVisible: boolean }) => {
            const res = await fetch(`/api/events/${eventId}/food-sessions/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isVisible }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update visibility');
            }
            return res.json();
        },
        onSuccess: (_data, variables) => {
            invalidate();
            toast({ title: variables.isVisible ? 'Session Shown in App' : 'Session Hidden from App' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/events/${eventId}/food-sessions/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete food session');
            }
            return res.json();
        },
        onSuccess: () => {
            invalidate();
            setDeleteTarget(null);
            toast({ title: 'Food Session Deleted' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setIsDialogOpen(true);
    };

    const openEdit = (session: FoodSession) => {
        setEditing(session);
        setForm({ name: session.name, limit: String(session.limit), maxLimit: String(session.maxLimit) });
        setIsDialogOpen(true);
    };

    const sessions = data?.sessions ?? [];
    const totalAdmitted = sessions.reduce((s, x) => s + x.count, 0);
    const totalCapacity = sessions.reduce((s, x) => s + x.maxLimit, 0);

    return (
        <div className="space-y-5">
            {/* Summary + add */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex gap-6">
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Sessions</p>
                        <p className="text-2xl font-bold text-foreground tabular-nums">{sessions.length}</p>
                    </div>
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Admitted</p>
                        <p className="text-2xl font-bold text-foreground tabular-nums">{totalAdmitted}</p>
                    </div>
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Capacity</p>
                        <p className="text-2xl font-bold text-foreground tabular-nums">{totalCapacity}</p>
                    </div>
                </div>
                {canManage && (
                    <Button size="sm" onClick={openCreate}>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Session
                    </Button>
                )}
            </div>

            {isLoading ? (
                <div className="py-4"><LoadingFrame label="Loading sessions" /></div>
            ) : sessions.length === 0 ? (
                <BoxyFrame className="bg-card/40 py-12 text-center text-muted-foreground text-sm">
                    No food sessions yet.{canManage ? ' Add one to get started.' : ''}
                </BoxyFrame>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sessions.map((session) => {
                        const pct = session.maxLimit > 0 ? Math.min(100, Math.round((session.count / session.maxLimit) * 100)) : 0;
                        const barColor = session.stats.full ? 'bg-rose-400' : 'bg-white';
                        return (
                            <BoxyFrame
                                key={session._id}
                                className={`p-5 ${session.isVisible ? 'bg-card/40' : 'bg-card/20'}`}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`font-medium truncate ${session.isVisible ? 'text-foreground' : 'text-muted-foreground'}`}>{session.name}</span>
                                            {!session.isVisible && <Badge variant="secondary">Hidden</Badge>}
                                            {session.stats.full && <Badge variant="destructive">Full</Badge>}
                                            {!session.stats.full && session.stats.nearLimit && <Badge variant="outline">Near limit</Badge>}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                                            {session.count} admitted · {session.stats.remainingToMax} of {session.maxLimit} left
                                        </p>
                                    </div>
                                    <span className="text-2xl font-bold text-foreground tabular-nums shrink-0">{pct}%</span>
                                </div>

                                {/* Progress */}
                                <div className="mt-4 w-full bg-muted h-2 overflow-hidden">
                                    <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                                </div>
                                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                                    <span>Limit {session.limit}</span>
                                    <span>Max {session.maxLimit}</span>
                                </div>

                                {/* Footer: live map + manage controls */}
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                                    <Link
                                        href={`/food-map/${eventId}/${session._id}`}
                                        target="_blank"
                                        className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:opacity-80 transition-opacity"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h4v4H4zM10 5h4v4h-4zM16 5h4v4h-4zM4 11h4v4H4zM10 11h4v4h-4zM16 11h4v4h-4z" />
                                        </svg>
                                        Live Map
                                    </Link>
                                    {canManage && (
                                        <div className="flex items-center gap-2">
                                            <label className="flex items-center gap-2 cursor-pointer mr-1">
                                                <Switch
                                                    checked={session.isVisible}
                                                    onCheckedChange={(checked) => visibilityMutation.mutate({ id: session._id, isVisible: checked })}
                                                    disabled={visibilityMutation.isPending}
                                                />
                                                <span className="text-xs text-muted-foreground">{session.isVisible ? 'Visible' : 'Hidden'}</span>
                                            </label>
                                            <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => openEdit(session)}>Edit</Button>
                                            <Button size="sm" variant="destructive" className="h-8 px-3" onClick={() => setDeleteTarget(session)}>Delete</Button>
                                        </div>
                                    )}
                                </div>
                            </BoxyFrame>
                        );
                    })}
                </div>
            )}

            {/* Create / Edit dialog */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditing(null); setForm(emptyForm); } }}>
                <DialogContent className="bg-popover border border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Food Session' : 'Add Food Session'}</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Limit is a soft warning threshold; Max Limit is the hard capacity (scans are rejected once it is reached).
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="fs-name">Session Name</Label>
                            <Input
                                id="fs-name"
                                placeholder="Lunch — Hall A"
                                className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fs-limit">Limit (soft)</Label>
                                <Input
                                    id="fs-limit"
                                    type="number"
                                    min={0}
                                    placeholder="100"
                                    className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                                    value={form.limit}
                                    onChange={(e) => setForm((f) => ({ ...f, limit: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="fs-max">Max Limit (hard)</Label>
                                <Input
                                    id="fs-max"
                                    type="number"
                                    min={1}
                                    placeholder="150"
                                    className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                                    value={form.maxLimit}
                                    onChange={(e) => setForm((f) => ({ ...f, maxLimit: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={saveMutation.isPending}>
                                {saveMutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Session'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="bg-popover border border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Delete Food Session</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Delete &quot;{deleteTarget?.name}&quot;? This also removes its scan records. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)} disabled={deleteMutation.isPending}>
                            {deleteMutation.isPending ? 'Deleting…' : 'Delete Session'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
