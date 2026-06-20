'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { LoadingFrame, DotMatrixLoader } from '@/components/dot-matrix';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { TicketTemplateEditor } from '@/components/TicketTemplateEditor';
import { BoxyFrame } from '@/components/boxy';

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
    attendance: {
        markedAt: string;
        source: 'web' | 'mobile';
    } | null;
    qrPayload?: string | null;
    emailSentAt?: string | null;
    emailStatus?: 'pending' | 'sent' | 'failed';
}

interface TicketTemplate {
    imagePath?: string;
    qrPosition?: { x: number; y: number; width: number; height: number };
    namePosition?: { x: number; y: number; fontSize: number; color: string };
}

interface Event {
    _id: string;
    title: string;
    description: string;
    date: string;
    isPublicDownload: boolean;
    ticketTemplate?: TicketTemplate;
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

const manualRegistrationSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    regNo: z.string().min(1, 'Registration number is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(5, 'Phone number must be at least 5 characters'),
});

type ManualRegistrationFormValues = z.infer<typeof manualRegistrationSchema>;

async function fetchEventDetail(eventId: string): Promise<EventDetailResponse> {
    const res = await fetch(`/api/events/${eventId}`);
    if (!res.ok) throw new Error('Failed to fetch event');
    return res.json();
}

export default function EventRegistrationsPage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const { eventId } = use(params);
    const router = useRouter();
    const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
    const [selectedQrEmail, setSelectedQrEmail] = useState<string | null>(null);
    const [qrCodeData, setQrCodeData] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
    const [syncToken, setSyncToken] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'waiting' | 'received' | 'error'>('idle');
    const [urlCopied, setUrlCopied] = useState(false);
    const [filter, setFilter] = useState<'all' | 'attended' | 'pending'>('all');
    const [search, setSearch] = useState('');
    const syncPollRef = useRef<NodeJS.Timeout | null>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data, isLoading, error } = useQuery({
        queryKey: ['event', eventId],
        queryFn: () => fetchEventDetail(eventId),
    });

    const manualRegForm = useForm<ManualRegistrationFormValues>({
        resolver: zodResolver(manualRegistrationSchema),
        defaultValues: { name: '', regNo: '', email: '', phone: '' },
    });

    const manualRegMutation = useMutation({
        mutationFn: async (data: ManualRegistrationFormValues) => {
            const res = await fetch('/api/registrations/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, name: data.name, regNo: data.regNo, email: data.email, phone: data.phone }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to register');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['event', eventId] });
            setIsManualDialogOpen(false);
            manualRegForm.reset();
            toast({ title: 'Registration Added' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const markAttendanceMutation = useMutation({
        mutationFn: async (email: string) => {
            const res = await fetch('/api/attendance/mark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, email, source: 'web' }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to mark attendance');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['event', eventId] });
            toast({ title: 'Attendance Marked' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (registrationIds: string[]) => {
            const res = await fetch('/api/registrations/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, registrationIds }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to delete');
            }
            return res.json();
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['event', eventId] });
            setSelectedIds(new Set());
            toast({ title: 'Deleted', description: `${result.deletedCount} registration(s) deleted` });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });



    // ─── Extension Sync Logic ───
    const generateSyncToken = () => {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    };

    const getSyncUrl = useCallback(() => {
        if (!syncToken) return '';
        const base = window.location.origin;
        return `${base}/api/registrations/extension-sync?token=${syncToken}`;
    }, [syncToken]);

    const startSync = useCallback(async () => {
        const token = generateSyncToken();
        setSyncToken(token);
        setSyncStatus('waiting');
        setUrlCopied(false);

        // Register the token
        try {
            await fetch(`/api/registrations/extension-sync?token=${token}&action=register`);
        } catch {
            setSyncStatus('error');
            return;
        }

        // Start polling
        const poll = setInterval(async () => {
            try {
                const res = await fetch(`/api/registrations/extension-sync?token=${token}`);
                const result = await res.json();

                if (result.status === 'ready' && result.data) {
                    clearInterval(poll);
                    setSyncStatus('received');

                    // Store data in sessionStorage and redirect to upload page
                    sessionStorage.setItem('extensionSyncData', JSON.stringify(result.data));
                    setIsSyncDialogOpen(false);

                    toast({ title: 'Data Received', description: `${result.data.length} registrations received from extension` });

                    router.push(`/dashboard/events/${eventId}/registrations/upload?source=extension`);
                } else if (result.status === 'expired') {
                    clearInterval(poll);
                    setSyncStatus('error');
                    toast({ title: 'Sync Expired', description: 'The sync session expired. Please try again.', variant: 'destructive' });
                }
            } catch {
                // Polling error, will retry
            }
        }, 2000);

        syncPollRef.current = poll;
    }, [eventId, router, toast]);

    const stopSync = useCallback(() => {
        if (syncPollRef.current) {
            clearInterval(syncPollRef.current);
            syncPollRef.current = null;
        }
        setSyncStatus('idle');
        setSyncToken(null);
    }, []);

    const handleSyncDialogChange = useCallback((open: boolean) => {
        setIsSyncDialogOpen(open);
        if (open) {
            startSync();
        } else {
            stopSync();
        }
    }, [startSync, stopSync]);

    const copySyncUrl = useCallback(async () => {
        const url = getSyncUrl();
        if (url) {
            await navigator.clipboard.writeText(url);
            setUrlCopied(true);
            toast({ title: 'Copied!', description: 'Sync URL copied to clipboard' });
            setTimeout(() => setUrlCopied(false), 2000);
        }
    }, [getSyncUrl, toast]);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (syncPollRef.current) {
                clearInterval(syncPollRef.current);
            }
        };
    }, []);

    async function handleViewQr(email: string) {
        setSelectedQrEmail(email);
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <LoadingFrame label="Loading registrations" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="text-center py-20">
                <p className="text-rose-300">Failed to load event</p>
                <Link href="/dashboard">
                    <Button className="mt-4">Back to Events</Button>
                </Link>
            </div>
        );
    }

    const { event, registrations } = data;

    // Header action-cell styling + table filter helpers.
    const actionCell = 'flex items-center justify-center px-4 py-3.5 text-sm font-medium text-foreground border-l border-t border-border transition-colors';
    const attendedCount = registrations.filter((r) => r.attended).length;
    const pendingCount = registrations.length - attendedCount;
    const base = filter === 'attended'
        ? registrations.filter((r) => r.attended)
        : filter === 'pending'
            ? registrations.filter((r) => !r.attended)
            : registrations;
    const q = search.trim().toLowerCase();
    const visibleRegistrations = q
        ? base.filter((r) =>
            [r.name, r.email, r.regNo, r.phone].some((v) => (v || '').toLowerCase().includes(q)))
        : base;
    const filterCls = (key: 'all' | 'attended' | 'pending') =>
        `pill px-3 py-1.5 text-sm font-medium transition-colors border ${
            filter === key
                ? 'bg-foreground text-background border-transparent'
                : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
        }`;

    return (
        <div className="space-y-6">
            {/* Header */}
            <BoxyFrame className="bg-card/40">
                <div className="flex flex-col sm:flex-row">
                    <div className="flex-1 p-5">
                        <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">Registrations</h2>
                        <p className="text-muted-foreground text-sm mt-1">Manage attendees for {event.title}</p>
                    </div>
                    <div className="flex-1 p-5 flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-border">
                        <span className="text-muted-foreground">Total Reg :</span>
                        <span className="text-2xl font-bold text-foreground tabular-nums">{registrations.length}</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-border -ml-px">
                    <button type="button" onClick={() => setIsManualDialogOpen(true)} className={`${actionCell} hover:bg-accent`}>Add Reg</button>
                    <Link href={`/dashboard/events/${eventId}/registrations/upload`} className={`${actionCell} hover:bg-accent`}>Upload CSV</Link>
                    <button type="button" onClick={() => handleSyncDialogChange(true)} className={`${actionCell} hover:bg-accent`}>Import From Ext</button>
                    <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ['event', eventId] })} className={`${actionCell} hover:bg-accent`}>Refresh</button>
                </div>
            </BoxyFrame>

            {/* Add Registration dialog (opened from header) */}
            <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
                        <DialogContent className="bg-popover border-border text-foreground">
                            <DialogHeader>
                                <DialogTitle>Add Registration</DialogTitle>
                                <DialogDescription className="text-muted-foreground">
                                    Enter the attendee details to register for this event.
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...manualRegForm}>
                                <form onSubmit={manualRegForm.handleSubmit((d) => manualRegMutation.mutate(d))} className="space-y-4">
                                    <FormField
                                        control={manualRegForm.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Name</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="John Doe"
                                                        className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={manualRegForm.control}
                                        name="regNo"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Registration Number</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="REG001"
                                                        className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={manualRegForm.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="email"
                                                        placeholder="user@example.com"
                                                        className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={manualRegForm.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Phone</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="tel"
                                                        placeholder="9876543210"
                                                        className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={manualRegMutation.isPending}
                                    >
                                        {manualRegMutation.isPending ? 'Adding...' : 'Add Registration'}
                                    </Button>
                                </form>
                            </Form>
                        </DialogContent>
            </Dialog>

            {/* Import from Extension dialog (opened from header) */}
            <Dialog open={isSyncDialogOpen} onOpenChange={handleSyncDialogChange}>
                        <DialogContent className="bg-popover border-border text-foreground sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                                        <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                                    </svg>
                                    Import from Extension
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground">
                                    Send registration data from the Thanima Chrome extension to this event.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-6 py-4">
                                {/* Status */}
                                {syncStatus === 'waiting' && (
                                    <div className="flex flex-col items-center gap-4 py-6">
                                        <LoadingFrame label="Loading registrations" />
                                        <div className="text-center">
                                            <p className="font-medium text-foreground">Waiting for data...</p>
                                            <p className="text-sm text-muted-foreground mt-1">Open the extension and paste the URL below</p>
                                        </div>
                                    </div>
                                )}

                                {syncStatus === 'error' && (
                                    <div className="flex flex-col items-center gap-3 py-6">
                                        <div className="w-12 h-12 border border-rose-900/60 bg-rose-900/20 flex items-center justify-center">
                                            <span className="text-rose-300 text-xl">✕</span>
                                        </div>
                                        <p className="text-rose-300 font-medium">Sync failed or expired</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => { stopSync(); startSync(); }}
                                        >
                                            Try Again
                                        </Button>
                                    </div>
                                )}

                                {/* Sync URL */}
                                {syncStatus === 'waiting' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground">Sync URL</label>
                                        <div className="flex gap-2">
                                            <Input
                                                readOnly
                                                value={getSyncUrl()}
                                                className="bg-card border-border text-muted-foreground text-xs font-mono"
                                            />
                                            <Button
                                                onClick={copySyncUrl}
                                                variant="outline"
                                                className="shrink-0"
                                            >
                                                {urlCopied ? (
                                                    <>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                                                            <polyline points="20 6 9 17 4 12" />
                                                        </svg>
                                                        Copied
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                        </svg>
                                                        Copy
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Paste this URL in the Chrome extension&apos;s &quot;Sync to Webapp&quot; section
                                        </p>
                                    </div>
                                )}
                            </div>
                        </DialogContent>
            </Dialog>

            {/* Registrations Table */}
            <BoxyFrame className="bg-card/40">
                {/* Title / filter / search bar */}
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-4 border-b border-border">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground mr-1">
                            Total Reg: <span className="font-bold text-foreground tabular-nums">{registrations.length}</span>
                        </span>
                        <button type="button" onClick={() => setFilter('all')} className={filterCls('all')}>All ({registrations.length})</button>
                        <button type="button" onClick={() => setFilter('attended')} className={filterCls('attended')}>Attended : {attendedCount}</button>
                        <button type="button" onClick={() => setFilter('pending')} className={filterCls('pending')}>Pending : {pendingCount}</button>
                    </div>
                    <div className="lg:ml-auto w-full lg:w-72">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name, email, reg no…"
                            className="bg-card border-border text-foreground placeholder:text-muted-foreground h-9"
                        />
                    </div>
                </div>
                <div className="p-6 overflow-hidden">
                    <RegistrationTable
                        registrations={visibleRegistrations}
                        onMarkAttendance={(email) => markAttendanceMutation.mutate(email)}
                        onViewQr={handleViewQr}
                        onDelete={(ids) => deleteMutation.mutate(ids)}
                        isMarking={markAttendanceMutation.isPending}
                        isDeleting={deleteMutation.isPending}
                        selectedIds={selectedIds}
                        onSelectionChange={setSelectedIds}
                    />
                </div>
            </BoxyFrame>

            {/* QR Code Dialog */}
            <Dialog open={!!selectedQrEmail} onOpenChange={() => { setSelectedQrEmail(null); setQrCodeData(null); }}>
                <DialogContent className="bg-popover border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>QR Code</DialogTitle>
                        <DialogDescription className="text-muted-foreground flex flex-col items-center gap-1">
                            <span>{selectedQrEmail}</span>
                            {(() => {
                                const reg = registrations.find(r => r.email === selectedQrEmail);
                                return reg?.regNo ? (
                                    <span className="text-foreground font-mono font-medium">{reg.regNo}</span>
                                ) : null;
                            })()}
                        </DialogDescription>
                    </DialogHeader>
                    <QRCodeDisplay eventId={eventId} email={selectedQrEmail} onGenerated={setQrCodeData} />
                    <div className="flex justify-center p-4">
                        {qrCodeData && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={qrCodeData} alt="QR Code" />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function RegistrationTable({
    registrations,
    onMarkAttendance,
    onViewQr,
    onDelete,
    isMarking,
    isDeleting,
    selectedIds,
    onSelectionChange,
}: {
    registrations: Registration[];
    onMarkAttendance: (email: string) => void;
    onViewQr: (email: string) => void;
    onDelete: (ids: string[]) => void;
    isMarking: boolean;
    isDeleting: boolean;
    selectedIds: Set<string>;
    onSelectionChange: (ids: Set<string>) => void;
}) {
    const currentPageIds = registrations.map(r => r._id);
    const selectedInPage = currentPageIds.filter(id => selectedIds.has(id));
    const allSelected = currentPageIds.length > 0 && selectedInPage.length === currentPageIds.length;
    const someSelected = selectedInPage.length > 0;

    function toggleAll() {
        if (allSelected) {
            const newSet = new Set(selectedIds);
            currentPageIds.forEach(id => newSet.delete(id));
            onSelectionChange(newSet);
        } else {
            const newSet = new Set(selectedIds);
            currentPageIds.forEach(id => newSet.add(id));
            onSelectionChange(newSet);
        }
    }

    function toggleOne(id: string) {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        onSelectionChange(newSet);
    }

    if (registrations.length === 0) {
        return <p className="text-muted-foreground text-center py-8">No registrations found</p>;
    }

    return (
        <div>
            {someSelected && (
                <div className="flex items-center justify-between mb-4 p-3 border border-border bg-card">
                    <span className="text-foreground">
                        {selectedInPage.length} registration(s) selected
                    </span>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(selectedInPage)}
                        disabled={isDeleting}
                    >
                        {isDeleting ? 'Deleting...' : `Delete Selected (${selectedInPage.length})`}
                    </Button>
                </div>
            )}
            <Table className="[&_th]:border-r [&_th]:border-border [&_td]:border-r [&_td]:border-border [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0">
                <TableHeader>
                    <TableRow className="border-border">
                        <TableHead className="w-12">
                            <Checkbox
                                checked={allSelected}
                                onCheckedChange={toggleAll}
                                aria-label="Select all"
                            />
                        </TableHead>
                        <TableHead className="text-muted-foreground">Name</TableHead>
                        <TableHead className="text-muted-foreground">Reg No</TableHead>
                        <TableHead className="text-muted-foreground">Downloads</TableHead>
                        <TableHead className="text-muted-foreground">Email</TableHead>
                        <TableHead className="text-muted-foreground">Status</TableHead>
                        <TableHead className="text-muted-foreground">Marked At</TableHead>
                        <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {registrations.map((reg) => (
                        <TableRow key={reg._id} className="border-border">
                            <TableCell>
                                <Checkbox
                                    checked={selectedIds.has(reg._id)}
                                    onCheckedChange={() => toggleOne(reg._id)}
                                    aria-label={`Select ${reg.name}`}
                                />
                            </TableCell>
                            <TableCell className="text-foreground font-medium">
                                <div className="max-w-[150px] truncate" title={reg.name}>{reg.name}</div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{reg.regNo}</TableCell>
                            <TableCell>
                                <span className={`font-medium ${(reg.downloadCount || 0) > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {reg.downloadCount || 0}
                                </span>
                            </TableCell>
                            <TableCell>
                                {reg.emailStatus === 'sent' ? (
                                    <Badge variant="success">
                                        Sent
                                    </Badge>
                                ) : reg.emailStatus === 'failed' ? (
                                    <Badge variant="destructive">
                                        Failed
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary">
                                        Pending
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell>
                                <Badge variant={reg.attended ? 'success' : 'secondary'}>
                                    {reg.attended ? 'Attended' : 'Pending'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {reg.attendance ? format(new Date(reg.attendance.markedAt), 'Pp') : '-'}
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                                {reg.qrPayload ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onViewQr(reg.email)}
                                    >
                                        QR
                                    </Button>
                                ) : (
                                    <span className="text-muted-foreground text-xs italic">No QR</span>
                                )}
                                {!reg.attended && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onMarkAttendance(reg.email)}
                                        disabled={isMarking}
                                    >
                                        Mark
                                    </Button>
                                )}
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => onDelete([reg._id])}
                                    disabled={isDeleting}
                                    className="bg-rose-900/20"
                                >
                                    Delete
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function QRCodeDisplay({
    eventId,
    email,
    onGenerated
}: {
    eventId: string;
    email: string | null;
    onGenerated: (data: string) => void;
}) {
    useEffect(() => {
        if (!email) return;

        // Fetch encrypted QR code from API
        fetch(`/api/qr/${eventId}/${encodeURIComponent(email)}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch QR code');
                return res.json();
            })
            .then(data => {
                if (data.qrCode) {
                    onGenerated(data.qrCode);
                }
            })
            .catch(console.error);
    }, [eventId, email, onGenerated]);

    return null;
}

