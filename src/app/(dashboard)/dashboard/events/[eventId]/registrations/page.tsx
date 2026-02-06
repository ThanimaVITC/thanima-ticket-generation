'use client';

import { useState, useEffect, use } from 'react';
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
    const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
    const [selectedQrEmail, setSelectedQrEmail] = useState<string | null>(null);
    const [qrCodeData, setQrCodeData] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

