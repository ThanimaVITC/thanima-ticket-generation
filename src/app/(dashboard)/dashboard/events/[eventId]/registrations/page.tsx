'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
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

    const { event, registrations } = data;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Registrations</h2>
                    <p className="text-gray-400 text-sm">Manage attendees for {event.title}</p>
                </div>
                <div className="flex space-x-2">
                    <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-white/20 text-gray-300 hover:text-white">
                                Add Registration
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-950 border-white/10 text-white">
                            <DialogHeader>
                                <DialogTitle>Add Registration</DialogTitle>
                                <DialogDescription className="text-gray-500">
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
                                                        className="bg-white/10 border-white/20"
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
                                                        className="bg-white/10 border-white/20"
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
                                                        className="bg-white/10 border-white/20"
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
                                                        className="bg-white/10 border-white/20"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button
                                        type="submit"
                                        className="w-full bg-purple-600 hover:bg-purple-700"
                                        disabled={manualRegMutation.isPending}
                                    >
                                        {manualRegMutation.isPending ? 'Adding...' : 'Add Registration'}
                                    </Button>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>

                    <Link href={`/dashboard/events/${eventId}/registrations/upload`}>
                        <Button className="bg-purple-600 hover:bg-purple-700">
                            Upload CSV/XLS
                        </Button>
                    </Link>

                    <Dialog open={isSyncDialogOpen} onOpenChange={handleSyncDialogChange}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                                    <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                                </svg>
                                Import from Extension
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-950 border-white/10 text-white sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                                        <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                                    </svg>
                                    Import from Extension
                                </DialogTitle>
                                <DialogDescription className="text-gray-400">
                                    Send registration data from the Thanima Chrome extension to this event.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-6 py-4">
                                {/* Status */}
                                {syncStatus === 'waiting' && (
                                    <div className="flex flex-col items-center gap-4 py-6">
                                        <div className="relative">
                                            <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full"></div>
                                            <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-400 rounded-full border-t-transparent animate-spin"></div>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-medium text-white">Waiting for data...</p>
                                            <p className="text-sm text-gray-500 mt-1">Open the extension and paste the URL below</p>
                                        </div>
                                    </div>
                                )}

                                {syncStatus === 'error' && (
                                    <div className="flex flex-col items-center gap-3 py-6">
                                        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                                            <span className="text-red-400 text-xl">✕</span>
                                        </div>
                                        <p className="text-red-400 font-medium">Sync failed or expired</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-white/20 text-gray-300"
                                            onClick={() => { stopSync(); startSync(); }}
                                        >
                                            Try Again
                                        </Button>
                                    </div>
                                )}

                                {/* Sync URL */}
                                {syncStatus === 'waiting' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-300">Sync URL</label>
                                        <div className="flex gap-2">
                                            <Input
                                                readOnly
                                                value={getSyncUrl()}
                                                className="bg-white/5 border-white/10 text-gray-300 text-xs font-mono"
                                            />
                                            <Button
                                                onClick={copySyncUrl}
                                                variant="outline"
                                                className={`shrink-0 border-white/20 transition-all ${urlCopied
                                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                        : 'text-gray-300 hover:text-white'
                                                    }`}
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
                                        <p className="text-xs text-gray-500 mt-1">
                                            Paste this URL in the Chrome extension&apos;s &quot;Sync to Webapp&quot; section
                                        </p>
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button
                        variant="outline"
                        className="border-white/20 text-white hover:bg-white/10"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['event', eventId] })}
                    >
                        <span className="mr-2">↻</span> Refresh
                    </Button>
                </div>
            </div>

            {/* Registrations Table */}
            <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-6">
                    <Tabs defaultValue="all">
                        <TabsList className="bg-white/5 border border-white/10 rounded-xl">
                            <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-white/10">All ({registrations.length})</TabsTrigger>
                            <TabsTrigger value="attended" className="rounded-lg data-[state=active]:bg-white/10">
                                Attended ({registrations.filter((r) => r.attended).length})
                            </TabsTrigger>
                            <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-white/10">
                                Pending ({registrations.filter((r) => !r.attended).length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="all">
                            <RegistrationTable
                                registrations={registrations}
                                onMarkAttendance={(email) => markAttendanceMutation.mutate(email)}
                                onViewQr={handleViewQr}
                                onDelete={(ids) => deleteMutation.mutate(ids)}
                                isMarking={markAttendanceMutation.isPending}
                                isDeleting={deleteMutation.isPending}
                                selectedIds={selectedIds}
                                onSelectionChange={setSelectedIds}
                            />
                        </TabsContent>
                        <TabsContent value="attended">
                            <RegistrationTable
                                registrations={registrations.filter((r) => r.attended)}
                                onMarkAttendance={(email) => markAttendanceMutation.mutate(email)}
                                onViewQr={handleViewQr}
                                onDelete={(ids) => deleteMutation.mutate(ids)}
                                isMarking={markAttendanceMutation.isPending}
                                isDeleting={deleteMutation.isPending}
                                selectedIds={selectedIds}
                                onSelectionChange={setSelectedIds}
                            />
                        </TabsContent>
                        <TabsContent value="pending">
                            <RegistrationTable
                                registrations={registrations.filter((r) => !r.attended)}
                                onMarkAttendance={(email) => markAttendanceMutation.mutate(email)}
                                onViewQr={handleViewQr}
                                onDelete={(ids) => deleteMutation.mutate(ids)}
                                isMarking={markAttendanceMutation.isPending}
                                isDeleting={deleteMutation.isPending}
                                selectedIds={selectedIds}
                                onSelectionChange={setSelectedIds}
                            />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* QR Code Dialog */}
            <Dialog open={!!selectedQrEmail} onOpenChange={() => { setSelectedQrEmail(null); setQrCodeData(null); }}>
                <DialogContent className="bg-slate-950 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>QR Code</DialogTitle>
                        <DialogDescription className="text-gray-500 flex flex-col items-center gap-1">
                            <span>{selectedQrEmail}</span>
                            {(() => {
                                const reg = registrations.find(r => r.email === selectedQrEmail);
                                return reg?.regNo ? (
                                    <span className="text-purple-400 font-mono font-medium">{reg.regNo}</span>
                                ) : null;
                            })()}
                        </DialogDescription>
                    </DialogHeader>
                    <QRCodeDisplay eventId={eventId} email={selectedQrEmail} onGenerated={setQrCodeData} />
                    <div className="flex justify-center p-4">
                        {qrCodeData && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={qrCodeData} alt="QR Code" className="rounded-lg" />
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
        return <p className="text-gray-400 text-center py-8">No registrations found</p>;
    }

    return (
        <div>
            {someSelected && (
                <div className="flex items-center justify-between mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                    <span className="text-white">
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
            <Table>
                <TableHeader>
                    <TableRow className="border-white/10">
                        <TableHead className="w-12">
                            <Checkbox
                                checked={allSelected}
                                onCheckedChange={toggleAll}
                                aria-label="Select all"
                            />
                        </TableHead>
                        <TableHead className="text-gray-400">Name</TableHead>
                        <TableHead className="text-gray-400">Reg No</TableHead>
                        <TableHead className="text-gray-400">Email</TableHead>
                        <TableHead className="text-gray-400">Phone</TableHead>
                        <TableHead className="text-gray-400">Downloads</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                        <TableHead className="text-gray-400">Marked At</TableHead>
                        <TableHead className="text-gray-400 text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {registrations.map((reg) => (
                        <TableRow key={reg._id} className="border-white/10">
                            <TableCell>
                                <Checkbox
                                    checked={selectedIds.has(reg._id)}
                                    onCheckedChange={() => toggleOne(reg._id)}
                                    aria-label={`Select ${reg.name}`}
                                />
                            </TableCell>
                            <TableCell className="text-white font-medium">{reg.name}</TableCell>
                            <TableCell className="text-gray-300">{reg.regNo}</TableCell>
                            <TableCell className="text-gray-300">{reg.email}</TableCell>
                            <TableCell className="text-gray-300">{reg.phone || '-'}</TableCell>
                            <TableCell>
                                <span className={`font-medium ${(reg.downloadCount || 0) > 0 ? 'text-blue-400' : 'text-gray-500'}`}>
                                    {reg.downloadCount || 0}
                                </span>
                            </TableCell>
                            <TableCell>
                                <Badge
                                    variant={reg.attended ? 'default' : 'secondary'}
                                    className={reg.attended ? 'bg-green-600' : 'bg-gray-600'}
                                >
                                    {reg.attended ? 'Attended' : 'Pending'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-gray-400">
                                {reg.attendance ? format(new Date(reg.attendance.markedAt), 'Pp') : '-'}
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onViewQr(reg.email)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    QR
                                </Button>
                                {!reg.attended && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onMarkAttendance(reg.email)}
                                        disabled={isMarking}
                                        className="text-green-400 hover:text-green-300"
                                    >
                                        Mark
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onDelete([reg._id])}
                                    disabled={isDeleting}
                                    className="text-red-400 hover:text-red-300"
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

