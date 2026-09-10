'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// Emptying the pool at the end of a session. It stamps exitedAt on every active stay,
// exactly as removing each person one by one would — the history rows stay, and anyone
// removed can be scanned back in.
export function RemoveAllFromPool({ eventId, disabled }: { eventId: string; disabled?: boolean }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    // Shares the manager's cache entry, so this reads the live count without its own fetch.
    const { data: active } = useQuery<{ stats: { currentCount: number } }>({
        queryKey: ['user-pool', eventId, 'active'],
        enabled: false,
    });
    const currentCount = active?.stats.currentCount ?? 0;

    const removeAll = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/events/${eventId}/user-pool/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ all: true }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to empty the pool');
            return data as { removed: number; message: string };
        },
        onSuccess: (data) => {
            toast({ title: 'Pool emptied', description: data.message });
            setIsConfirmOpen(false);
            queryClient.invalidateQueries({ queryKey: ['user-pool', eventId] });
        },
        onError: (err: Error) => {
            toast({ title: 'Could not empty the pool', description: err.message, variant: 'destructive' });
        },
    });

    if (disabled) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setIsConfirmOpen(true)}
                className="inline-flex shrink-0 items-center gap-2 px-4 py-2 border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            >
                Remove All
            </button>

            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogContent className="bg-popover border border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Remove everyone from the pool?</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {currentCount === 0
                                ? 'Nobody is in the pool right now.'
                                : `${currentCount} ${currentCount === 1 ? 'person is' : 'people are'} inside. Each stay is closed off now and appears in the history with its duration — nothing is deleted, and anyone can be scanned back in.`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={removeAll.isPending || currentCount === 0}
                            onClick={() => removeAll.mutate()}
                        >
                            {removeAll.isPending ? 'Removing…' : `Remove ${currentCount || ''}`.trim()}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
