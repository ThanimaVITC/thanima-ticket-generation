'use client';

import { useState } from 'react';
import { LoadingFrame } from '@/components/dot-matrix';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BoxyFrame } from '@/components/boxy';
import { BackToEvent, headerCell, headerActionCell, headerCreateCell, headerStatCell } from '@/components/back-to-event';
import { useToast } from '@/hooks/use-toast';
import { REG_NO_PATTERN } from '@/lib/unpaid';

interface UnpaidEntry {
    _id: string;
    name: string;
    regNo: string;
    source: 'manual' | 'ocr';
    createdAt: string;
}

interface UnpaidResponse {
    unpaidEnabled: boolean;
    entries: UnpaidEntry[];
    stats: { total: number };
}

async function fetchUnpaid(eventId: string): Promise<UnpaidResponse> {
    const res = await fetch(`/api/events/${eventId}/unpaid`);
    if (!res.ok) throw new Error('Failed to fetch the unpaid list');
    return res.json();
}

const EXPORT_HEADERS = ['Name', 'Registration No'] as const;

function baseFileName(eventTitle: string) {
    return `${(eventTitle || 'event').replace(/[^a-zA-Z0-9]/g, '_')}_unpaid`;
}

function triggerDownload(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function downloadCsv(entries: UnpaidEntry[], eventTitle: string) {
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [EXPORT_HEADERS, ...entries.map((e) => [e.name, e.regNo])]
        .map((row) => row.map(escape).join(','))
        .join('\n');

    // BOM so Excel reads the file as UTF-8 instead of mangling accented names.
    triggerDownload(
        new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }),
        `${baseFileName(eventTitle)}.csv`
    );
}

// xlsx is already a dependency, but it is a heavy one. Loading it on demand
// keeps it out of this page's bundle for everyone who never picks Excel.
async function downloadXlsx(entries: UnpaidEntry[], eventTitle: string) {
    const XLSX = await import('xlsx');

    const sheet = XLSX.utils.aoa_to_sheet([
        [...EXPORT_HEADERS],
        ...entries.map((e) => [e.name, e.regNo]),
    ]);
    // Excel's default column width truncates most names on open.
    sheet['!cols'] = [{ wch: 30 }, { wch: 18 }];

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Unpaid');
    XLSX.writeFile(book, `${baseFileName(eventTitle)}.xlsx`);
}

export function UnpaidManager({
    eventId,
    canManage,
    enabled,
    eventTitle = '',
}: {
    eventId: string;
    canManage: boolean;
    enabled: boolean;
    eventTitle?: string;
}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [name, setName] = useState('');
    const [regNo, setRegNo] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<UnpaidEntry | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['unpaid', eventId],
        queryFn: () => fetchUnpaid(eventId),
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['unpaid', eventId] });
        queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    };

    const addMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/events/${eventId}/unpaid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, regNo, source: 'manual' }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || 'Failed to add');
            return body;
        },
        onSuccess: (body) => {
            toast({ title: 'Added to the unpaid list', description: `${body.entry.name} · ${body.entry.regNo}` });
            setName('');
            setRegNo('');
            setIsAddOpen(false);
            invalidate();
        },
        onError: (err: Error) => {
            toast({ title: 'Could not add', description: err.message, variant: 'destructive' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (entryId: string) => {
            const res = await fetch(`/api/events/${eventId}/unpaid/${entryId}`, { method: 'DELETE' });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || 'Failed to remove');
            return body;
        },
        onSuccess: () => {
            toast({ title: 'Removed from the unpaid list' });
            setDeleteTarget(null);
            invalidate();
        },
        onError: (err: Error) => {
            toast({ title: 'Could not remove', description: err.message, variant: 'destructive' });
            setDeleteTarget(null);
        },
    });

    // Mirrors the server's normalizeRegNo so the dialog rejects a bad number
    // before it costs a round trip.
    const cleanedRegNo = regNo.replace(/[\s._/-]/g, '').toUpperCase();
    const regNoValid = REG_NO_PATTERN.test(cleanedRegNo);
    const canSubmit = name.trim().length >= 2 && regNoValid && !addMutation.isPending;

    return (
        <div className="space-y-6">
            <BoxyFrame className="bg-card/40">
                <div className="p-5">
                    <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
                        Unpaid Participants{eventTitle ? ` for ${eventTitle}` : ''}
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        People who attended without paying. Staff add them from the mobile app by
                        scanning an ID card, or manually here.
                    </p>
                </div>
                <div className={`grid grid-cols-2 ${canManage && enabled ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} border-t border-border -ml-px`}>
                    <BackToEvent eventId={eventId} label="Back to Overview" className={headerActionCell} />
                    <div className={headerStatCell}>
                        <span className="text-muted-foreground">Total :</span>
                        <span className="font-bold text-foreground tabular-nums">{data?.stats.total ?? 0}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsDownloadOpen(true)}
                        disabled={!data || data.entries.length === 0}
                        className={`${headerCell} hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent`}
                    >
                        Download List
                    </button>
                    {canManage && enabled && (
                        <button type="button" onClick={() => setIsAddOpen(true)} className={headerCreateCell}>
                            Add Participant +
                        </button>
                    )}
                </div>
            </BoxyFrame>

            {/* The list is its own card, separate from the page header */}
            <BoxyFrame className="bg-card/40">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <LoadingFrame label="Loading" />
                    </div>
                ) : !data || data.entries.length === 0 ? (
                    <p className="text-muted-foreground text-sm p-8 text-center">
                        Nobody is on the unpaid list. Staff add people from the mobile app by
                        scanning an ID card, or here with Add Participant.
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border">
                                <TableHead className="text-muted-foreground">Name</TableHead>
                                <TableHead className="text-muted-foreground">Reg No</TableHead>
                                <TableHead className="text-muted-foreground">Added</TableHead>
                                <TableHead className="text-muted-foreground">Via</TableHead>
                                {canManage && <TableHead className="text-muted-foreground text-right">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.entries.map((entry) => (
                                <TableRow key={entry._id} className="border-border">
                                    <TableCell className="text-foreground font-medium">{entry.name}</TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-xs">{entry.regNo}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {format(new Date(entry.createdAt), 'MMM d, h:mm a')}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={entry.source === 'ocr' ? 'secondary' : 'outline'}>
                                            {entry.source === 'ocr' ? 'ID scan' : 'Manual'}
                                        </Badge>
                                    </TableCell>
                                    {canManage && (
                                        <TableCell className="text-right">
                                            <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(entry)}>
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

            {/* Format picker */}
            <Dialog open={isDownloadOpen} onOpenChange={(open) => !isExporting && setIsDownloadOpen(open)}>
                <DialogContent className="bg-popover border border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Download the unpaid list</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {data?.entries.length ?? 0} {(data?.entries.length ?? 0) === 1 ? 'person' : 'people'},
                            exported as name and registration number.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid sm:grid-cols-2 gap-3 mt-2">
                        <button
                            type="button"
                            disabled={isExporting}
                            onClick={() => {
                                downloadCsv(data?.entries ?? [], eventTitle);
                                setIsDownloadOpen(false);
                            }}
                            className="border border-border p-4 text-left hover:bg-accent transition-colors disabled:opacity-50"
                        >
                            <div className="font-medium text-foreground">CSV</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Plain text. Opens anywhere — Excel, Sheets, Numbers.
                            </p>
                        </button>
                        <button
                            type="button"
                            disabled={isExporting}
                            onClick={async () => {
                                setIsExporting(true);
                                try {
                                    await downloadXlsx(data?.entries ?? [], eventTitle);
                                    setIsDownloadOpen(false);
                                } catch {
                                    toast({
                                        title: 'Excel export failed',
                                        description: 'Try CSV instead.',
                                        variant: 'destructive',
                                    });
                                } finally {
                                    setIsExporting(false);
                                }
                            }}
                            className="border border-border p-4 text-left hover:bg-accent transition-colors disabled:opacity-50"
                        >
                            <div className="font-medium text-foreground">
                                {isExporting ? 'Preparing…' : 'Excel (.xlsx)'}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Real workbook with sized columns. Slightly slower to build.
                            </p>
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Manual add — the web has no card scanning, by design */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="bg-popover border border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Add to the unpaid list</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Name and registration number only — unpaid attendees have no
                            registration record to link to.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <div className="space-y-2">
                            <Label htmlFor="unpaid-name">Name</Label>
                            <Input
                                id="unpaid-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Arjun Menon"
                                className="bg-card border-border"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unpaid-regno">Registration Number</Label>
                            <Input
                                id="unpaid-regno"
                                value={regNo}
                                onChange={(e) => setRegNo(e.target.value)}
                                placeholder="23BCE1042"
                                className="bg-card border-border font-mono"
                            />
                            {regNo.length > 0 && !regNoValid && (
                                <p className="text-xs text-rose-300">Must look like 23BCE1042.</p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                            <Button onClick={() => addMutation.mutate()} disabled={!canSubmit}>
                                {addMutation.isPending ? 'Adding…' : 'Add'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="bg-popover border border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Remove from the unpaid list</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {deleteTarget && (
                                <>
                                    Remove <span className="text-foreground font-medium">{deleteTarget.name}</span>{' '}
                                    ({deleteTarget.regNo})? Use this for a typo or a bad card read —
                                    the entry is deleted, not marked paid.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'Removing…' : 'Remove'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
