'use client';

import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { downloadCsv, downloadXlsx, exportFileName } from '@/lib/table-export';
import { SCAN_STATUS_OPTIONS, matchesScanFilter, type ScanStatus } from '@/lib/food-export';

export type { ScanStatus };

export interface ExportSession {
    _id: string;
    colorName: string;
    colorHex: string;
    timing?: string;
}

export interface ExportAssignment {
    _id: string;
    name: string;
    regNo: string;
    email: string;
    sessionId: string;
    colorName: string;
    assignedAt: string;
    servedAt: string | null;
}

/** Segmented All / Scanned / Not Scanned control. */
export function ScanStatusPicker({
    value,
    onChange,
}: {
    value: ScanStatus;
    onChange: (v: ScanStatus) => void;
}) {
    return (
        <div className="flex gap-2">
            {SCAN_STATUS_OPTIONS.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={`px-4 py-2 text-sm font-medium transition-all border ${
                        value === opt.value
                            ? 'bg-foreground text-background border-transparent'
                            : 'bg-transparent text-muted-foreground border-border hover:bg-accent hover:text-foreground'
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

/** "All slots" plus one toggle per colour. Nothing selected == every slot. */
export function SlotPicker({
    sessions,
    selected,
    onChange,
}: {
    sessions: ExportSession[];
    selected: Set<string>;
    onChange: (next: Set<string>) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            <button
                type="button"
                onClick={() => onChange(new Set())}
                className={`px-3 py-1.5 text-xs border transition-colors ${
                    selected.size === 0
                        ? 'border-foreground text-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground'
                }`}
            >
                All slots
            </button>
            {sessions.map((s) => (
                <button
                    key={s._id}
                    type="button"
                    onClick={() => {
                        const next = new Set(selected);
                        if (next.has(s._id)) next.delete(s._id);
                        else next.add(s._id);
                        onChange(next);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors ${
                        selected.has(s._id)
                            ? 'border-foreground text-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.colorHex }} />
                    {s.colorName}
                    {s.timing ? <span className="opacity-60">· {s.timing}</span> : null}
                </button>
            ))}
        </div>
    );
}

const HEADERS = ['Name', 'Registration No', 'Email', 'Food Slot', 'Slot Time', 'Status', 'Scanned At'] as const;
const COL_WIDTHS = [30, 18, 32, 14, 18, 14, 22];

export function FoodScanDownloadDialog({
    open,
    onOpenChange,
    sessions,
    assignments,
    eventTitle,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessions: ExportSession[];
    assignments: ExportAssignment[];
    eventTitle: string;
}) {
    const { toast } = useToast();
    const [status, setStatus] = useState<ScanStatus>('scanned');
    const [slotIds, setSlotIds] = useState<Set<string>>(new Set());
    const [isExporting, setIsExporting] = useState(false);

    const timingBySession = useMemo(
        () => new Map(sessions.map((s) => [s._id, s.timing ?? ''])),
        [sessions]
    );

    const rows = useMemo(
        () =>
            assignments
                .filter((a) => matchesScanFilter(a, status, slotIds))
                .map((a) => [
                    a.name,
                    a.regNo,
                    a.email,
                    a.colorName,
                    timingBySession.get(a.sessionId) ?? '',
                    a.servedAt ? 'Scanned' : 'Not scanned',
                    a.servedAt ? new Date(a.servedAt).toLocaleString() : '',
                ]),
        [assignments, status, slotIds, timingBySession]
    );

    const fileName = exportFileName(
        eventTitle,
        `food_${status}${slotIds.size > 0 ? `_${slotIds.size}slots` : ''}`
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-popover border border-border text-foreground max-w-lg">
                <DialogHeader>
                    <DialogTitle>Download food scan list</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Who has eaten, and who still has an unused slot. Only attendees who were
                        given a colour appear here.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 mt-2">
                    <Label className="text-sm font-medium text-muted-foreground">Scan Status</Label>
                    <ScanStatusPicker value={status} onChange={setStatus} />
                </div>

                <div className="space-y-3 mt-2">
                    <Label className="text-sm font-medium text-muted-foreground">Slots</Label>
                    <SlotPicker sessions={sessions} selected={slotIds} onChange={setSlotIds} />
                    <p className="text-xs text-muted-foreground">
                        {rows.length} of {assignments.length} records will be exported
                        {slotIds.size === 0 ? ' — every slot.' : '.'}
                    </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mt-2">
                    <button
                        type="button"
                        disabled={isExporting || rows.length === 0}
                        onClick={() => {
                            downloadCsv(HEADERS, rows, fileName);
                            onOpenChange(false);
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
                        disabled={isExporting || rows.length === 0}
                        onClick={async () => {
                            setIsExporting(true);
                            try {
                                await downloadXlsx(HEADERS, rows, fileName, {
                                    sheetName: 'Food Scans',
                                    colWidths: COL_WIDTHS,
                                });
                                onOpenChange(false);
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
    );
}
