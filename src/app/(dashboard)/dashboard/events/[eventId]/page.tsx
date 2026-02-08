'use client';

import { useState, use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { TicketTemplateEditor } from '@/components/TicketTemplateEditor';
import { QuizPublicToggle, QuizLeaderboardButton } from '@/components/QuizPublicToggle';

interface Registration {
    _id: string;
    downloadCount: number;
    attended: boolean;
}

interface TicketTemplate {
    imagePath?: string;
    qrLogoPath?: string;
    qrPosition?: { x: number; y: number; width: number; height: number };
    namePosition?: { x: number; y: number; fontSize: number; color: string };
}

interface Event {
    _id: string;
    title: string;
    description: string;
    date: string;
    isPublicDownload: boolean;
    isActiveDisplay?: boolean;
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

export default function EventDetailPage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const { eventId } = use(params);
    const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
    const [isDeleteEventDialogOpen, setIsDeleteEventDialogOpen] = useState(false);
    const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const router = useRouter();

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
                        <DialogContent className="bg-slate-950 border-white/10 text-white">
                            <DialogHeader>
                                <DialogTitle>Delete Event</DialogTitle>
                                <DialogDescription className="text-gray-500">
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

            {/* Settings Row */}
            <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Switch
                            id="active-display"
                            checked={event.isActiveDisplay || false}
                            onCheckedChange={async (checked) => {
                                try {
                                    const res = await fetch(`/api/events/${eventId}/set-active`, {
                                        method: checked ? 'POST' : 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                    });
                                    if (!res.ok) throw new Error('Failed to update');
                                    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
                                    toast({ title: checked ? 'Event Set as Main Event' : 'Event Removed from Main Display' });
                                } catch {
                                    toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
                                }
                            }}
                        />
                        <label htmlFor="active-display" className="text-sm text-gray-400">
                            Set as Main Event
                        </label>
                    </div>

                    <div className="flex items-center gap-3">
                        <Switch
                            id="public-download"
                            checked={event.isPublicDownload || false}
                            onCheckedChange={async (checked) => {
                                try {
                                    const res = await fetch(`/api/events/${eventId}/settings`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ isPublicDownload: checked }),
                                    });
                                    if (!res.ok) throw new Error('Failed to update');
                                    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
                                    toast({ title: checked ? 'Public Download Enabled' : 'Public Download Disabled' });
                                } catch {
                                    toast({ title: 'Error', description: 'Failed to update settings', variant: 'destructive' });
                                }
                            }}
                        />
                        <label htmlFor="public-download" className="text-sm text-gray-400">
                            Enable Public Ticket Download
                        </label>
                    </div>

                    <QuizPublicToggle eventId={eventId} />
                    <QuizLeaderboardButton eventId={eventId} />

                    <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl">
                                {event.ticketTemplate?.imagePath ? 'Edit Template' : 'Setup Template'}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-950 border-white/10 text-white max-w-7xl w-full max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Ticket Template Setup</DialogTitle>
                                <DialogDescription className="text-gray-500">
                                    Upload a template image and customize the QR code and name positioning.
                                </DialogDescription>
                            </DialogHeader>
                            <TicketTemplateEditor
                                eventId={eventId}
                                template={event.ticketTemplate}
                                onSave={() => {
                                    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
                                    setIsTemplateDialogOpen(false);
                                }}
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
                    <p className="text-gray-500 text-sm mb-1">Registrations</p>
                    <p className="text-3xl font-bold text-white">{stats.totalRegistrations}</p>
                </div>
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
                    <p className="text-gray-500 text-sm mb-1">Attendance</p>
                    <p className="text-3xl font-bold text-green-400">{stats.totalAttendance}</p>
                </div>
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
                    <p className="text-gray-500 text-sm mb-1">Attendance Rate</p>
                    <p className="text-3xl font-bold text-purple-400">{stats.attendanceRate}%</p>
                </div>
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
                    <p className="text-gray-500 text-sm mb-1">Ticket Downloads</p>
                    <p className="text-3xl font-bold text-blue-400">
                        {registrations.reduce((sum, r) => sum + (r.downloadCount || 0), 0)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                        {registrations.length > 0
                            ? Math.round((registrations.filter(r => (r.downloadCount || 0) > 0).length / registrations.length) * 100)
                            : 0
                        }% of users downloaded
                    </p>
                </div>
            </div>
        </div>
    );
}
