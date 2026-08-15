'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadingFrame } from '@/components/dot-matrix';
import { BoxyFrame } from '@/components/boxy';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// Moving someone between colours lives here and nowhere else. The mobile app has no
// call site for it by design — the door assigns, the dashboard corrects.

interface AssignmentSession {
    _id: string;
    color: string;
    colorName: string;
    colorHex: string;
    maxLimit: number;
    count: number;
    stats: { remainingToMax: number; full: boolean };
}

interface Assignment {
    _id: string;
    email: string;
    regNo: string;
    name: string;
    sessionId: string;
    color: string;
    colorName: string;
    colorHex: string;
    assignedAt: string;
    servedAt: string | null;
}

interface AssignmentsResponse {
    sessions: AssignmentSession[];
    assignments: Assignment[];
}

async function fetchAssignments(eventId: string): Promise<AssignmentsResponse> {
    const res = await fetch(`/api/events/${eventId}/food-assignments`);
    if (!res.ok) throw new Error('Failed to fetch food assignments');
    return res.json();
}

export function FoodAssignmentsManager({
    eventId,
    canManage,
}: {
    eventId: string;
    canManage: boolean;
}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [search, setSearch] = useState('');
    const [colorFilter, setColorFilter] = useState<string>('');
    const [moving, setMoving] = useState<Assignment | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['food-assignments', eventId],
        queryFn: () => fetchAssignments(eventId),
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['food-assignments', eventId] });
        queryClient.invalidateQueries({ queryKey: ['food-sessions', eventId] });
    };

    const moveMutation = useMutation({
        mutationFn: async ({ id, foodSessionId }: { id: string; foodSessionId: string }) => {
            const res = await fetch(`/api/events/${eventId}/food-assignments/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ foodSessionId }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to change food slot');
            }
            return res.json();
        },
        onSuccess: () => {
            invalidate();
            setMoving(null);
            toast({ title: 'Food Slot Changed' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const removeMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/events/${eventId}/food-assignments/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to remove food slot');
            }
            return res.json();
        },
        onSuccess: () => {
            invalidate();
            setMoving(null);
            toast({ title: 'Food Slot Removed' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const sessions = data?.sessions ?? [];
    const assignments = data?.assignments ?? [];

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return assignments.filter((a) => {
            if (colorFilter && a.color !== colorFilter) return false;
            if (!q) return true;
            return (
                a.name.toLowerCase().includes(q) ||
                a.regNo.toLowerCase().includes(q) ||
                a.email.toLowerCase().includes(q)
            );
        });
    }, [assignments, search, colorFilter]);

    if (isLoading) {
        return <div className="py-4"><LoadingFrame label="Loading assignments" /></div>;
    }

    if (assignments.length === 0) {
        return (
            <BoxyFrame className="bg-card/40 py-10 text-center text-muted-foreground text-sm">
                Nobody has been given a food colour yet. Slots are assigned when attendees are
                marked present in the app.
            </BoxyFrame>
        );
    }

    return (
        <BoxyFrame className="bg-card/40">
            <div className="p-5 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Assigned Attendees</h2>
                <p className="text-muted-foreground text-sm mt-1">
                    {assignments.length} assigned. Changing someone&apos;s colour can only be done here.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 items-center">
                    <Input
                        placeholder="Search name, reg no, or email"
                        className="bg-card border-border text-foreground placeholder:text-muted-foreground max-w-xs"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={() => setColorFilter('')}
                        className={`px-3 py-1.5 text-xs border transition-colors ${
                            colorFilter === '' ? 'border-foreground text-foreground' : 'border-border text-muted-foreground'
                        }`}
                    >
                        All
                    </button>
                    {sessions.map((s) => (
                        <button
                            key={s._id}
                            type="button"
                            onClick={() => setColorFilter(colorFilter === s.color ? '' : s.color)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors ${
                                colorFilter === s.color ? 'border-foreground text-foreground' : 'border-border text-muted-foreground'
                            }`}
                        >
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.colorHex }} />
                            {s.colorName}
                        </button>
                    ))}
                </div>
            </div>

            <div className="divide-y divide-border max-h-[28rem] overflow-auto thin-scroll">
                {filtered.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-8">No matches.</p>
                ) : (
                    filtered.map((a) => (
                        <div key={a._id} className="flex items-center gap-3 px-5 py-3">
                            <span
                                className="w-4 h-4 rounded-full shrink-0 ring-1 ring-white/20"
                                style={{ backgroundColor: a.colorHex }}
                                title={a.colorName}
                            />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-foreground truncate">{a.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {a.regNo} · {a.colorName}
                                </p>
                            </div>
                            {a.servedAt ? (
                                <Badge variant="success">Served</Badge>
                            ) : (
                                <Badge variant="secondary">Not served</Badge>
                            )}
                            {canManage && (
                                <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => setMoving(a)}>
                                    Change
                                </Button>
                            )}
                        </div>
                    ))
                )}
            </div>

            <Dialog open={!!moving} onOpenChange={(open) => { if (!open) setMoving(null); }}>
                <DialogContent className="bg-popover border border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Change Food Colour</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {moving?.name} is currently {moving?.colorName}
                            {moving?.servedAt ? ' and has already been served.' : '.'} Pick a new colour, or
                            remove their slot to hand the seat back.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-wrap gap-3 py-2">
                        {sessions.map((s) => {
                            const current = s._id === moving?.sessionId;
                            const full = s.stats.full && !current;
                            return (
                                <button
                                    key={s._id}
                                    type="button"
                                    disabled={current || full || moveMutation.isPending}
                                    onClick={() => moving && moveMutation.mutate({ id: moving._id, foodSessionId: s._id })}
                                    title={full ? `${s.colorName} — full` : s.colorName}
                                    className={`flex flex-col items-center gap-1.5 p-2 transition-all ${
                                        current ? 'opacity-40' : full ? 'opacity-25 cursor-not-allowed' : 'hover:scale-105'
                                    }`}
                                >
                                    <span
                                        className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-black/70 tabular-nums ${
                                            current ? 'ring-2 ring-foreground' : 'ring-1 ring-white/20'
                                        }`}
                                        style={{ backgroundColor: s.colorHex }}
                                    >
                                        {s.stats.remainingToMax}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">{s.colorName}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex justify-between gap-2 pt-2 border-t border-border">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => moving && removeMutation.mutate(moving._id)}
                            disabled={removeMutation.isPending}
                        >
                            {removeMutation.isPending ? 'Removing…' : 'Remove slot'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setMoving(null)}>Cancel</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </BoxyFrame>
    );
}
