'use client';

import { useEffect, useState } from 'react';
import { LoadingFrame } from '@/components/dot-matrix';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BoxyFrame } from '@/components/boxy';
import { useToast } from '@/hooks/use-toast';
import { formatDuration } from '@/lib/user-pool';

interface PoolEntry {
    _id: string;
    name: string;
    regNo: string;
    email: string;
    phone: string;
    nfcId: string;
    enteredAt: string;
    exitedAt: string | null;
    durationMs: number;
}

interface PoolResponse {
    userPoolEnabled: boolean;
    entries: PoolEntry[];
    stats: {
        currentCount: number;
        totalVisits: number;
        uniqueUsers: number;
    };
}

async function fetchPool(eventId: string, status: 'active' | 'all'): Promise<PoolResponse> {
    const res = await fetch(`/api/events/${eventId}/user-pool?status=${status}`);
    if (!res.ok) throw new Error('Failed to fetch the user pool');
    return res.json();
}

export function UserPoolManager({
    eventId,
    canManage,
}: {
    eventId: string;
    canManage: boolean;
}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [removeTarget, setRemoveTarget] = useState<PoolEntry | null>(null);

    // One ticker for the whole table so the "time in pool" column counts up
    // without re-fetching.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const { data: active, isLoading: activeLoading } = useQuery({
        queryKey: ['user-pool', eventId, 'active'],
        queryFn: () => fetchPool(eventId, 'active'),
        refetchInterval: 30_000,
    });

    const { data: history, isLoading: historyLoading } = useQuery({
        queryKey: ['user-pool', eventId, 'all'],
        queryFn: () => fetchPool(eventId, 'all'),
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['user-pool', eventId] });

    const removeMutation = useMutation({
        mutationFn: async (entryId: string) => {
            const res = await fetch(`/api/events/${eventId}/user-pool/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entryId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to remove from the pool');
            return data;
        },
        onSuccess: (data) => {
            toast({
                title: 'Removed from the pool',
                description: `${data.entry.name} was in the pool for ${formatDuration(data.durationMs)}.`,
            });
            setRemoveTarget(null);
            invalidate();
        },
        onError: (err: Error) => {
            toast({ title: 'Could not remove', description: err.message, variant: 'destructive' });
            setRemoveTarget(null);
            invalidate();
        },
    });

    // For active stays, count up from enteredAt rather than trusting the
    // durationMs snapshot the server sent at fetch time.
    const liveDuration = (entry: PoolEntry) =>
        entry.exitedAt
            ? entry.durationMs
            : now - new Date(entry.enteredAt).getTime();

    return (
        <div className="space-y-6">
            {/* Card 1 — who is in the pool right now */}
            <BoxyFrame className="bg-card/40">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-border">
                    <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Live</div>
                        <h2 className="text-lg font-semibold text-foreground">In the pool now</h2>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="font-display text-4xl italic text-foreground">
                            {active?.stats.currentCount ?? 0}
                        </span>
                        <span className="text-sm text-muted-foreground">inside</span>
                    </div>
                </div>

                {activeLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <LoadingFrame label="Loading" />
                    </div>
                ) : !active || active.entries.length === 0 ? (
                    <p className="text-muted-foreground text-sm p-8 text-center">
                        Nobody is in the pool. Staff add people from the mobile app by scanning a
                        ticket and then tapping the ID card.
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border">
                                <TableHead className="text-muted-foreground">Name</TableHead>
                                <TableHead className="text-muted-foreground">Reg No</TableHead>
                                <TableHead className="text-muted-foreground">Phone</TableHead>
                                <TableHead className="text-muted-foreground">Card ID</TableHead>
                                <TableHead className="text-muted-foreground">Entered</TableHead>
                                <TableHead className="text-muted-foreground">Time in pool</TableHead>
                                {canManage && <TableHead className="text-muted-foreground text-right">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {active.entries.map((entry) => (
                                <TableRow key={entry._id} className="border-border">
                                    <TableCell className="text-foreground font-medium">{entry.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{entry.regNo || '—'}</TableCell>
                                    <TableCell className="text-muted-foreground">{entry.phone || '—'}</TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-xs">{entry.nfcId}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {format(new Date(entry.enteredAt), 'MMM d, h:mm a')}
                                    </TableCell>
                                    <TableCell className="text-foreground font-mono text-xs tabular-nums">
                                        {formatDuration(liveDuration(entry))}
                                    </TableCell>
                                    {canManage && (
                                        <TableCell className="text-right">
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => setRemoveTarget(entry)}
                                            >
                                                Remove
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </BoxyFrame>

            {/* Card 2 — everyone who has ever used the pool */}
            <BoxyFrame className="bg-card/40">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-border">
                    <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">History</div>
                        <h2 className="text-lg font-semibold text-foreground">Users who have used the pool</h2>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {history?.stats.uniqueUsers ?? 0} people · {history?.stats.totalVisits ?? 0} visits
                    </div>
                </div>

                {historyLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <LoadingFrame label="Loading" />
                    </div>
                ) : !history || history.entries.length === 0 ? (
                    <p className="text-muted-foreground text-sm p-8 text-center">
                        Nobody has used the pool yet.
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border">
                                <TableHead className="text-muted-foreground">Name</TableHead>
                                <TableHead className="text-muted-foreground">Reg No</TableHead>
                                <TableHead className="text-muted-foreground">Entered</TableHead>
                                <TableHead className="text-muted-foreground">Exited</TableHead>
                                <TableHead className="text-muted-foreground">Duration</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {history.entries.map((entry) => (
                                <TableRow key={entry._id} className="border-border">
                                    <TableCell className="text-foreground font-medium">{entry.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{entry.regNo || '—'}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {format(new Date(entry.enteredAt), 'MMM d, h:mm a')}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {entry.exitedAt ? (
                                            format(new Date(entry.exitedAt), 'MMM d, h:mm a')
                                        ) : (
                                            <Badge variant="success">In pool</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-foreground font-mono text-xs tabular-nums">
                                        {formatDuration(liveDuration(entry))}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </BoxyFrame>

            {/* Manual removal — the escape hatch for a lost or unreadable card */}
            <Dialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
                <DialogContent className="bg-popover border border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Remove from the pool</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {removeTarget && (
                                <>
                                    Remove <span className="text-foreground font-medium">{removeTarget.name}</span>
                                    {removeTarget.regNo ? ` (${removeTarget.regNo})` : ''} from the pool? They have
                                    been in for {formatDuration(liveDuration(removeTarget))}. Normally this happens
                                    by tapping their ID card in the app — use this only when the card can&apos;t be read.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => removeTarget && removeMutation.mutate(removeTarget._id)}
                            disabled={removeMutation.isPending}
                        >
                            {removeMutation.isPending ? 'Removing…' : 'Remove'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
