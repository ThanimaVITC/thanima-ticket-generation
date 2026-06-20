'use client';

import { useState, use } from 'react';
import { LoadingFrame } from '@/components/dot-matrix';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { BoxyFrame } from '@/components/boxy';

interface Registration {
    _id: string;
    name: string;
    email: string;
    phone: string;
    downloadCount: number;
    attended: boolean;
    regNo: string;
    emailStatus?: 'pending' | 'sent' | 'failed';
    attendance?: { markedAt: string; source: string } | null;
}

interface TicketTemplate {
    imagePath?: string;
    qrLogoPath?: string;
    qrPosition?: { x: number; y: number; width: number; height: number };
    namePosition?: { x: number; y: number; fontSize: number; color: string };
    rotateTicket?: boolean;
}

interface Event {
    _id: string;
    title: string;
    description: string;
    date: string;
    isPublicDownload: boolean;
    isActiveDisplay?: boolean;
    foodSessionsEnabled?: boolean;
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
        emailStats: {
            sentCount: number;
            pendingCount: number;
            failedCount: number;
            emailSendRate: number;
        };
    };
}

const manualRegistrationSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    regNo: z.string().min(1, 'Registration number is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(5, 'Phone number must be at least 5 characters'),
});

type ManualRegistrationFormValues = z.infer<typeof manualRegistrationSchema>;

const editEventSchema = z.object({
    title: z.string().min(2, 'Title must be at least 2 characters'),
    description: z.string().optional(),
    date: z.string().min(1, 'Date is required'),
});

type EditEventFormValues = z.infer<typeof editEventSchema>;

interface CurrentUser {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'event_admin' | 'app_user';
    assignedEvents: string[];
}

async function fetchEventDetail(eventId: string): Promise<EventDetailResponse> {
    const res = await fetch(`/api/events/${eventId}`);
    if (!res.ok) throw new Error('Failed to fetch event');
    return res.json();
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
}

// Neutral chart ramp that reads on both light and dark backgrounds (recharts
// fills can't consume CSS tokens, so these stay literal mid-grays).
const COLORS = ['#8a8a8a', '#a3a3a3', '#6b6b6b', '#bdbdbd', '#545454', '#9e9e9e', '#777777', '#cfcfcf'];

// Convert an ISO date string to the value format expected by <input type="datetime-local">
function toDateTimeLocal(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventDetailPage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const { eventId } = use(params);
    const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
    const [isEditEventDialogOpen, setIsEditEventDialogOpen] = useState(false);
    const [isDeleteEventDialogOpen, setIsDeleteEventDialogOpen] = useState(false);
    const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
    const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'attended' | 'not_attended'>('all');
    const [downloadFields, setDownloadFields] = useState<Record<string, boolean>>({
        name: true,
        regNo: true,
        email: true,
        phone: true,
        attendanceStatus: true,
        attendanceTime: false,
        emailStatus: false,
        downloadCount: false,
    });
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const router = useRouter();

    const { data, isLoading, error } = useQuery({
        queryKey: ['event', eventId],
        queryFn: () => fetchEventDetail(eventId),
    });

    const { data: currentUser } = useQuery({
        queryKey: ['current-user'],
        queryFn: fetchCurrentUser,
    });

    const canEditEvent = currentUser?.role === 'admin' || currentUser?.role === 'event_admin';

    const manualRegForm = useForm<ManualRegistrationFormValues>({
        resolver: zodResolver(manualRegistrationSchema),
        defaultValues: { name: '', regNo: '', email: '', phone: '' },
    });

    const editEventForm = useForm<EditEventFormValues>({
        resolver: zodResolver(editEventSchema),
        defaultValues: { title: '', description: '', date: '' },
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

    const editEventMutation = useMutation({
        mutationFn: async (values: EditEventFormValues) => {
            const res = await fetch(`/api/events/${eventId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: values.title,
                    description: values.description ?? '',
                    date: new Date(values.date).toISOString(),
                }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to update event');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['event', eventId] });
            setIsEditEventDialogOpen(false);
            toast({ title: 'Event Updated', description: 'Event details have been updated.' });
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

    // Push-button access controls. Returns a promise so the button can show pending state.
    async function patchSettings(body: Record<string, unknown>, onMsg: string) {
        const res = await fetch(`/api/events/${eventId}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            toast({ title: 'Error', description: 'Failed to update settings', variant: 'destructive' });
            return;
        }
        queryClient.invalidateQueries({ queryKey: ['event', eventId] });
        toast({ title: onMsg });
    }

    const downloadFieldLabels: Record<string, string> = {
        name: 'Name',
        regNo: 'Registration No',
        email: 'Email',
        phone: 'Phone',
        attendanceStatus: 'Attendance Status',
        attendanceTime: 'Attendance Time',
        emailStatus: 'Email Status',
        downloadCount: 'Download Count',
    };

    const getFilteredRegistrations = (regs: Registration[]) => {
        if (attendanceFilter === 'attended') return regs.filter(r => r.attended);
        if (attendanceFilter === 'not_attended') return regs.filter(r => !r.attended);
        return regs;
    };

    const handleDownload = () => {
        if (!data) return;
        const filtered = getFilteredRegistrations(data.registrations);
        const selectedFields = Object.entries(downloadFields).filter(([, v]) => v).map(([k]) => k);
        if (selectedFields.length === 0) return;

        const headers = selectedFields.map(f => downloadFieldLabels[f]);
        const rows = filtered.map(reg => {
            return selectedFields.map(field => {
                switch (field) {
                    case 'name': return reg.name || '';
                    case 'regNo': return reg.regNo || '';
                    case 'email': return reg.email || '';
                    case 'phone': return reg.phone || '';
                    case 'attendanceStatus': return reg.attended ? 'Present' : 'Absent';
                    case 'attendanceTime': return reg.attendance?.markedAt ? new Date(reg.attendance.markedAt).toLocaleString() : '';
                    case 'emailStatus': return reg.emailStatus || 'pending';
                    case 'downloadCount': return String(reg.downloadCount || 0);
                    default: return '';
                }
            });
        });

        const csvContent = [headers, ...rows].map(row =>
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${data.event.title.replace(/[^a-zA-Z0-9]/g, '_')}_applicants.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsDownloadDialogOpen(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <LoadingFrame label="Loading event" />
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

    const { event, registrations, stats } = data;

    const openEdit = () => {
        editEventForm.reset({
            title: event.title,
            description: event.description || '',
            date: toDateTimeLocal(event.date),
        });
        setIsEditEventDialogOpen(true);
    };

    // Shared cell styling for the Access & Settings grid (compact, single line).
    const cell = 'flex items-center justify-center gap-2 px-2 py-3.5 text-sm font-medium text-center border-l border-t border-border transition-colors';

    const regNoByYear = registrations.reduce((acc, reg) => {
        const match = reg.regNo.match(/^(\d{2})/);
        const year = match ? `20${match[1]}` : 'Unknown';
        acc[year] = (acc[year] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const regNoData = Object.entries(regNoByYear)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.name.localeCompare(a.name));

    const emailData = [
        { name: 'Sent', value: stats.emailStats.sentCount },
        { name: 'Pending', value: stats.emailStats.pendingCount },
        { name: 'Failed', value: stats.emailStats.failedCount },
    ].filter(d => d.value > 0);

    return (
        <div className="space-y-6">
            {/* Event Header */}
            <BoxyFrame className="bg-card/40">
                <div className="grid gap-6 p-6 sm:p-7 md:grid-cols-2">
                    <div className="flex items-center">
                        <h1 className="text-gradient-name font-serif text-4xl md:text-5xl tracking-tight leading-[1.05]" style={{ animationDelay: `-${event.title.length % 8}s` }}>{event.title}</h1>
                    </div>
                    <div className="flex md:justify-end">
                        <p className="text-muted-foreground text-sm leading-relaxed md:text-right max-w-md">
                            {event.description || 'No description provided.'}
                        </p>
                    </div>
                </div>

                {/* Info + actions row */}
                <div className="flex flex-wrap border-t border-border text-sm">
                    <div className="flex-1 min-w-[200px] px-5 py-3.5 flex items-center gap-2 text-muted-foreground">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {format(new Date(event.date), 'MMM d, yy · h:mm a')}
                    </div>
                    <div className="flex-1 min-w-[140px] px-5 py-3.5 border-l border-border flex items-center gap-1.5">
                        <span className="text-muted-foreground">Total Reg :</span>
                        <span className="font-bold text-foreground tabular-nums">{stats.totalRegistrations}</span>
                    </div>
                    <div className="flex-1 min-w-[140px] px-5 py-3.5 border-l border-border flex items-center gap-1.5">
                        <span className="text-muted-foreground">Attendance :</span>
                        <span className="font-bold text-foreground tabular-nums">{stats.totalAttendance}</span>
                    </div>
                    {canEditEvent && (
                        <button
                            type="button"
                            onClick={openEdit}
                            className="flex-[0.8] min-w-[104px] px-5 py-3.5 border-l border-border bg-amber-500 text-black font-medium flex items-center justify-center gap-2 hover:bg-amber-400 transition-colors"
                        >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Event
                        </button>
                    )}
                    {canEditEvent && (
                        <button
                            type="button"
                            onClick={() => setIsDeleteEventDialogOpen(true)}
                            className="flex-[0.8] min-w-[104px] px-5 py-3.5 border-l border-border bg-rose-600 text-white font-medium flex items-center justify-center gap-2 hover:bg-rose-500 transition-colors"
                        >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete event
                        </button>
                    )}
                </div>
            </BoxyFrame>

            {/* Edit / Delete dialogs (opened from the action row) */}
            {canEditEvent && (
                <>
                    <Dialog open={isEditEventDialogOpen} onOpenChange={setIsEditEventDialogOpen}>
                            <DialogContent className="bg-popover border border-border text-foreground">
                                <DialogHeader>
                                    <DialogTitle>Edit Event</DialogTitle>
                                    <DialogDescription className="text-muted-foreground">
                                        Update the event name, description, and date.
                                    </DialogDescription>
                                </DialogHeader>
                                <Form {...editEventForm}>
                                    <form onSubmit={editEventForm.handleSubmit((d) => editEventMutation.mutate(d))} className="space-y-4">
                                        <FormField
                                            control={editEventForm.control}
                                            name="title"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Name</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Event name" className="bg-card border-border" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={editEventForm.control}
                                            name="description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Description</FormLabel>
                                                    <FormControl>
                                                        <Textarea placeholder="Event description (optional)" className="bg-card border-border min-h-[80px]" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={editEventForm.control}
                                            name="date"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Date &amp; Time</FormLabel>
                                                    <FormControl>
                                                        <Input type="datetime-local" className="bg-card border-border [color-scheme:dark]" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <div className="flex justify-end gap-2 pt-2">
                                            <Button type="button" variant="outline" onClick={() => setIsEditEventDialogOpen(false)}>Cancel</Button>
                                            <Button type="submit" disabled={editEventMutation.isPending}>
                                                {editEventMutation.isPending ? 'Saving…' : 'Save Changes'}
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            </DialogContent>
                        </Dialog>

                    <Dialog open={isDeleteEventDialogOpen} onOpenChange={setIsDeleteEventDialogOpen}>
                        <DialogContent className="bg-popover border border-border text-foreground">
                                <DialogHeader>
                                    <DialogTitle>Delete Event</DialogTitle>
                                    <DialogDescription className="text-muted-foreground">
                                        Delete &quot;{event.title}&quot;? This also deletes all registrations and attendance records. This action cannot be undone.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="flex justify-end gap-2 mt-4">
                                    <Button variant="outline" onClick={() => setIsDeleteEventDialogOpen(false)}>Cancel</Button>
                                    <Button variant="destructive" onClick={() => deleteEventMutation.mutate()} disabled={deleteEventMutation.isPending}>
                                        {deleteEventMutation.isPending ? 'Deleting…' : 'Delete Event'}
                                    </Button>
                                </div>
                        </DialogContent>
                    </Dialog>
                </>
            )}

            {/* Access & Settings */}
            <BoxyFrame className="bg-card/40">
                <div className="grid md:grid-cols-[minmax(0,24rem)_1fr]">
                    <div className="p-5 flex flex-col justify-center border-b md:border-b-0 md:border-r border-border">
                        <h2 className="text-lg font-semibold text-foreground">Access &amp; Settings</h2>
                        <p className="text-muted-foreground text-sm mt-1">Toggle features and manage registrations for this event.</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 -mt-px -ml-px">
                        {/* Toggles — on = green, off = red */}
                        <button type="button" onClick={() => patchSettings({ isActiveDisplay: !event.isActiveDisplay }, event.isActiveDisplay ? 'Hidden from the homepage' : 'Now visible on the homepage')} className={`${cell} text-white ${event.isActiveDisplay ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-rose-600 hover:bg-rose-600'}`}>
                            <span>Public</span>
                            <span className="pill bg-white text-black font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">{event.isActiveDisplay ? 'On' : 'Off'}</span>
                        </button>
                        <button type="button" onClick={() => patchSettings({ isPublicDownload: !event.isPublicDownload }, event.isPublicDownload ? 'Public Download Disabled' : 'Public Download Enabled')} className={`${cell} text-white ${event.isPublicDownload ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-rose-600 hover:bg-rose-600'}`}>
                            <span>Ticket Download</span>
                            <span className="pill bg-white text-black font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">{event.isPublicDownload ? 'On' : 'Off'}</span>
                        </button>
                        <button type="button" onClick={() => patchSettings({ rotateTicket: !event.ticketTemplate?.rotateTicket }, event.ticketTemplate?.rotateTicket ? 'Ticket Rotation Disabled' : 'Ticket Rotation Enabled')} className={`${cell} text-white ${event.ticketTemplate?.rotateTicket ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-rose-600 hover:bg-rose-600'}`}>
                            <span>Rotate Ticket</span>
                            <span className="pill bg-white text-black font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">{event.ticketTemplate?.rotateTicket ? 'On' : 'Off'}</span>
                        </button>
                        <button type="button" onClick={() => patchSettings({ foodSessionsEnabled: !event.foodSessionsEnabled }, event.foodSessionsEnabled ? 'Food Sessions Disabled' : 'Food Sessions Enabled')} className={`${cell} text-white ${event.foodSessionsEnabled ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-rose-600 hover:bg-rose-600'}`}>
                            <span>Food Session</span>
                            <span className="pill bg-white text-black font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">{event.foodSessionsEnabled ? 'On' : 'Off'}</span>
                        </button>
                        {/* Actions — inverted (theme-flipped) */}
                        <button type="button" onClick={() => setIsManualDialogOpen(true)} className={`${cell} bg-foreground text-background hover:bg-foreground/90`}>
                            <span>Add Reg</span>
                        </button>
                        <Link href={`/dashboard/events/${eventId}/registrations/upload`} className={`${cell} bg-foreground text-background hover:bg-foreground/90`}>
                            <span>Upload</span>
                        </Link>
                        <button type="button" onClick={() => setIsDownloadDialogOpen(true)} className={`${cell} bg-foreground text-background hover:bg-foreground/90`}>
                            <span>Download</span>
                        </button>
                        <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ['event', eventId] })} className={`${cell} bg-foreground text-background hover:bg-foreground/90`}>
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>
            </BoxyFrame>

            {/* Add Registration dialog (opened from the grid) */}
            <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
                    <DialogContent className="bg-popover border border-border text-foreground">
                        <DialogHeader>
                            <DialogTitle>Add Registration</DialogTitle>
                            <DialogDescription className="text-muted-foreground">
                                Enter the attendee details to register for this event.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...manualRegForm}>
                            <form onSubmit={manualRegForm.handleSubmit((d) => manualRegMutation.mutate(d))} className="space-y-4">
                                <FormField control={manualRegForm.control} name="name" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl><Input placeholder="John Doe" className="bg-card border-border" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={manualRegForm.control} name="regNo" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Registration Number</FormLabel>
                                        <FormControl><Input placeholder="REG001" className="bg-card border-border" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={manualRegForm.control} name="email" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl><Input type="email" placeholder="user@example.com" className="bg-card border-border" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={manualRegForm.control} name="phone" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone</FormLabel>
                                        <FormControl><Input type="tel" placeholder="9876543210" className="bg-card border-border" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <Button type="submit" className="w-full" disabled={manualRegMutation.isPending}>
                                    {manualRegMutation.isPending ? 'Adding…' : 'Add Registration'}
                                </Button>
                            </form>
                        </Form>
                    </DialogContent>
            </Dialog>

            {/* Download dialog (opened from the grid) */}
            <Dialog open={isDownloadDialogOpen} onOpenChange={setIsDownloadDialogOpen}>
                    <DialogContent className="bg-popover border border-border text-foreground max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Download Applicant Data</DialogTitle>
                            <DialogDescription className="text-muted-foreground">
                                Choose which fields to include and filter by attendance status.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 mt-2">
                            <Label className="text-sm font-medium text-muted-foreground">Filter by Attendance</Label>
                            <div className="flex gap-2">
                                {[
                                    { value: 'all' as const, label: 'All' },
                                    { value: 'attended' as const, label: 'Attended' },
                                    { value: 'not_attended' as const, label: 'Not Attended' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setAttendanceFilter(opt.value)}
                                        className={`px-4 py-2 text-sm font-medium transition-all border ${attendanceFilter === opt.value
                                            ? 'bg-foreground text-background border-transparent'
                                            : 'bg-transparent text-muted-foreground border-border hover:bg-accent hover:text-foreground'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            {data && (
                                <p className="text-xs text-muted-foreground">
                                    {getFilteredRegistrations(data.registrations).length} of {data.registrations.length} records will be exported
                                </p>
                            )}
                        </div>

                        <div className="space-y-3 mt-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium text-muted-foreground">Fields to Include</Label>
                                <button
                                    onClick={() => {
                                        const allSelected = Object.values(downloadFields).every(v => v);
                                        setDownloadFields(Object.fromEntries(
                                            Object.keys(downloadFields).map(k => [k, !allSelected])
                                        ));
                                    }}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {Object.values(downloadFields).every(v => v) ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(downloadFieldLabels).map(([key, label]) => (
                                    <div key={key} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`field-${key}`}
                                            checked={downloadFields[key]}
                                            onCheckedChange={(checked) =>
                                                setDownloadFields(prev => ({ ...prev, [key]: !!checked }))
                                            }
                                            className="border-border data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=checked]:text-background"
                                        />
                                        <Label htmlFor={`field-${key}`} className="text-sm text-muted-foreground cursor-pointer select-none">
                                            {label as string}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end mt-4">
                            <Button onClick={handleDownload} disabled={!Object.values(downloadFields).some(v => v)}>
                                Download CSV
                            </Button>
                        </div>
                    </DialogContent>
            </Dialog>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BoxyFrame className="bg-card/40 p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Registrations by Year</h3>
                    {regNoData.length > 0 ? (
                        <div className="h-[300px] overflow-hidden">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={regNoData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.22)" vertical={false} />
                                    <XAxis dataKey="name" stroke="rgba(120,120,120,0.45)" tick={{ fill: '#6a6b6c', fontSize: 12 }} axisLine={{ stroke: 'rgba(120,120,120,0.28)' }} />
                                    <YAxis stroke="rgba(120,120,120,0.45)" tick={{ fill: '#6a6b6c', fontSize: 12 }} axisLine={{ stroke: 'rgba(120,120,120,0.28)' }} tickLine={{ stroke: 'rgba(120,120,120,0.28)' }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(120,120,120,0.14)' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const d = payload[0].payload;
                                                const total = regNoData.reduce((sum, x) => sum + x.value, 0);
                                                const percent = ((d.value / total) * 100).toFixed(1);
                                                return (
                                                    <div className="bg-popover border border-border px-3 py-2">
                                                        <p className="text-foreground font-medium">Year: {d.name}</p>
                                                        <p className="text-muted-foreground text-sm">{d.value} registrations ({percent}%)</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="value">
                                        {regNoData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[240px] flex items-center justify-center text-muted-foreground">
                            No registration data available
                        </div>
                    )}
                </BoxyFrame>

                <BoxyFrame className="bg-card/40 p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Email Status</h3>
                    {emailData.length > 0 ? (
                        <div className="h-[300px] overflow-hidden">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={emailData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.22)" vertical={false} />
                                    <XAxis dataKey="name" stroke="rgba(120,120,120,0.45)" tick={{ fill: '#6a6b6c', fontSize: 12 }} axisLine={{ stroke: 'rgba(120,120,120,0.28)' }} />
                                    <YAxis stroke="rgba(120,120,120,0.45)" tick={{ fill: '#6a6b6c', fontSize: 12 }} axisLine={{ stroke: 'rgba(120,120,120,0.28)' }} tickLine={{ stroke: 'rgba(120,120,120,0.28)' }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(120,120,120,0.14)' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const d = payload[0].payload;
                                                const total = emailData.reduce((sum, x) => sum + x.value, 0);
                                                const percent = ((d.value / total) * 100).toFixed(1);
                                                return (
                                                    <div className="bg-popover border border-border px-3 py-2">
                                                        <p className="text-foreground font-medium">{d.name}</p>
                                                        <p className="text-muted-foreground text-sm">{d.value} emails ({percent}%)</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="value">
                                        {emailData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[240px] flex items-center justify-center text-muted-foreground">
                            No email data available
                        </div>
                    )}
                </BoxyFrame>
            </div>
        </div>
    );
}
