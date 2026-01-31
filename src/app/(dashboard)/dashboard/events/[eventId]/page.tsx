'use client';

import { useState, useEffect, use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

interface Registration {
    _id: string;
    eventId: string;
    name: string;
    regNo: string;
    email: string;
    createdAt: string;
    attended: boolean;
    attendance: {
        markedAt: string;
        source: 'web' | 'mobile';
    } | null;
}

interface Event {
    _id: string;
    title: string;
    description: string;
    date: string;
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
});

type ManualRegistrationFormValues = z.infer<typeof manualRegistrationSchema>;

async function fetchEventDetail(eventId: string): Promise<EventDetailResponse> {
    const res = await fetch(`/api/events/${eventId}`);
    if (!res.ok) throw new Error('Failed to fetch event');
    return res.json();
}

export default function EventDetailPage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const { eventId } = use(params);
    const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
    const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
    const [selectedQrEmail, setSelectedQrEmail] = useState<string | null>(null);
    const [qrCodeData, setQrCodeData] = useState<string | null>(null);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleteEventDialogOpen, setIsDeleteEventDialogOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const router = useRouter();

    const { data, isLoading, error } = useQuery({
        queryKey: ['event', eventId],
        queryFn: () => fetchEventDetail(eventId),
    });

    const manualRegForm = useForm<ManualRegistrationFormValues>({
        resolver: zodResolver(manualRegistrationSchema),
        defaultValues: { name: '', regNo: '', email: '' },
    });

    const manualRegMutation = useMutation({
        mutationFn: async (data: ManualRegistrationFormValues) => {
            const res = await fetch('/api/registrations/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, name: data.name, regNo: data.regNo, email: data.email }),
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

    const deleteEventMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/events/${eventId}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to delete event');
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: 'Event Deleted', description: 'Event and all registrations have been deleted' });
            router.push('/dashboard');
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    async function handleCsvUpload() {
        if (!csvFile) return;
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', csvFile);
            formData.append('eventId', eventId);

            const res = await fetch('/api/registrations/csv', {
                method: 'POST',
                body: formData,
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'Upload failed');
            }

            toast({
                title: 'CSV Uploaded',
                description: `Inserted: ${result.stats.inserted}, Duplicates: ${result.stats.duplicates}`,
            });
            queryClient.invalidateQueries({ queryKey: ['event', eventId] });
            setIsCsvDialogOpen(false);
            setCsvFile(null);
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Upload failed',
                variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
        }
    }

    async function handleViewQr(email: string) {
        setSelectedQrEmail(email);
        // QR code will be generated in the dialog using useEffect
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
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

    const { event, registrations, stats } = data;

    return (
        <div className="space-y-6">
            {/* Back Button */}
            <Link href="/dashboard" className="inline-flex items-center text-gray-400 hover:text-white transition-colors">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Events
            </Link>

            {/* Event Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-white">{event.title}</h1>
                    {event.description && (
                        <p className="text-gray-400 mt-1">{event.description}</p>
                    )}
                    <div className="flex items-center text-gray-400 text-sm mt-2">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {format(new Date(event.date), 'PPP p')}
                    </div>
                </div>
                <div className="flex space-x-2">
                    <Dialog open={isDeleteEventDialogOpen} onOpenChange={setIsDeleteEventDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                                Delete Event
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-900 border-white/20 text-white">
                            <DialogHeader>
                                <DialogTitle>Delete Event</DialogTitle>
                                <DialogDescription className="text-gray-400">
                                    Are you sure you want to delete &quot;{event.title}&quot;? This will also delete all registrations and attendance records. This action cannot be undone.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex justify-end space-x-2 mt-4">
                                <Button variant="outline" onClick={() => setIsDeleteEventDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => deleteEventMutation.mutate()}
                                    disabled={deleteEventMutation.isPending}
                                >
                                    {deleteEventMutation.isPending ? 'Deleting...' : 'Delete Event'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-white/20 text-gray-300 hover:text-white">
                                Add Registration
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-900 border-white/20 text-white">
                            <DialogHeader>
                                <DialogTitle>Add Registration</DialogTitle>
                                <DialogDescription className="text-gray-400">
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

                    <Dialog open={isCsvDialogOpen} onOpenChange={setIsCsvDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-purple-600 hover:bg-purple-700">
                                Upload CSV
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-900 border-white/20 text-white">
                            <DialogHeader>
                                <DialogTitle>Upload CSV</DialogTitle>
                                <DialogDescription className="text-gray-400">
                                    Upload a CSV file with &quot;name&quot;, &quot;regno&quot;, and &quot;email&quot; columns.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <Input
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                                    className="bg-white/10 border-white/20"
                                />
                                <Button
                                    onClick={handleCsvUpload}
                                    className="w-full bg-purple-600 hover:bg-purple-700"
                                    disabled={!csvFile || isUploading}
                                >
                                    {isUploading ? 'Uploading...' : 'Upload'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-white/5 border-white/10">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-gray-400">Registrations</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-white">{stats.totalRegistrations}</p>
                    </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-gray-400">Attendance</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-green-400">{stats.totalAttendance}</p>
                    </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-gray-400">Attendance Rate</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-purple-400">{stats.attendanceRate}%</p>
                    </CardContent>
                </Card>
            </div>

            {/* Registrations Table */}
            <Card className="bg-white/5 border-white/10">
                <CardHeader>
                    <CardTitle className="text-white">Registrations</CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="all">
                        <TabsList className="bg-white/10">
                            <TabsTrigger value="all">All ({registrations.length})</TabsTrigger>
                            <TabsTrigger value="attended">
                                Attended ({registrations.filter((r) => r.attended).length})
                            </TabsTrigger>
                            <TabsTrigger value="pending">
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
                </CardContent>
            </Card>

            {/* QR Code Dialog */}
            <Dialog open={!!selectedQrEmail} onOpenChange={() => { setSelectedQrEmail(null); setQrCodeData(null); }}>
                <DialogContent className="bg-slate-900 border-white/20 text-white">
                    <DialogHeader>
                        <DialogTitle>QR Code</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            {selectedQrEmail}
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

        const payload = JSON.stringify({ eventId, email });

        QRCode.toDataURL(payload, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff',
            },
        }).then(onGenerated).catch(console.error);
    }, [eventId, email, onGenerated]);

    return null;
}
