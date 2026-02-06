'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Event {
    _id: string;
    title: string;
    description: string;
    date: string;
    createdAt: string;
    isActiveDisplay?: boolean;
    isPublicDownload?: boolean;
}

interface EventsResponse {
    events: Event[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

const createEventSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    date: z.string().min(1, 'Date is required'),
});

type CreateEventFormValues = z.infer<typeof createEventSchema>;

async function fetchEvents(): Promise<EventsResponse> {
    const res = await fetch('/api/events');
    if (!res.ok) throw new Error('Failed to fetch events');
    return res.json();
}

async function createEvent(data: CreateEventFormValues): Promise<{ event: Event }> {
    const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create event');
    }
    return res.json();
}

export default function DashboardPage() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data, isLoading, error } = useQuery({
        queryKey: ['events'],
        queryFn: fetchEvents,
    });

    const createMutation = useMutation({
        mutationFn: createEvent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            setIsDialogOpen(false);
            form.reset();
            toast({
                title: 'Event Created',
                description: 'Your event has been created successfully.',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const setActiveMutation = useMutation({
        mutationFn: async (eventId: string) => {
            const res = await fetch(`/api/events/${eventId}/set-active`, {
                method: 'POST',
            });
            if (!res.ok) throw new Error('Failed to set active event');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            toast({
                title: 'Active Event Updated',
                description: 'This event is now displayed on the homepage.',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const form = useForm<CreateEventFormValues>({
        resolver: zodResolver(createEventSchema),
        defaultValues: {
            title: '',
            description: '',
            date: '',
        },
    });

    function onSubmit(data: CreateEventFormValues) {
        createMutation.mutate(data);
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

    if (error) {
        return (
            <div className="text-center py-20">
                <p className="text-red-400">Failed to load events</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Events</h1>
                    <p className="text-gray-400 mt-1">Manage your events and attendance</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 shadow-lg shadow-purple-500/25 rounded-xl">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create Event
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-950 border-white/10 text-white">
                        <DialogHeader>
                            <DialogTitle>Create New Event</DialogTitle>
                            <DialogDescription className="text-gray-500">
                                Fill in the details to create a new event.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Title</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Event title"
                                                    className="bg-white/10 border-white/20"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Event description (optional)"
                                                    className="bg-white/10 border-white/20"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="date"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Date</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="datetime-local"
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
                                    className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 rounded-xl"
                                    disabled={createMutation.isPending}
                                >
                                    {createMutation.isPending ? 'Creating...' : 'Create Event'}
                                </Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
                    <p className="text-gray-500 text-sm mb-1">Total Events</p>
                    <p className="text-3xl font-bold text-white">{data?.pagination.total || 0}</p>
                </div>
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
                    <p className="text-gray-500 text-sm mb-1">Upcoming</p>
                    <p className="text-3xl font-bold text-purple-400">
                        {data?.events.filter((e) => new Date(e.date) > new Date()).length || 0}
                    </p>
                </div>
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
                    <p className="text-gray-500 text-sm mb-1">Past Events</p>
                    <p className="text-3xl font-bold text-gray-400">
                        {data?.events.filter((e) => new Date(e.date) <= new Date()).length || 0}
                    </p>
                </div>
            </div>

            {/* Events List */}
            {data?.events.length === 0 ? (
                <Card className="bg-white/5 border-white/10">
                    <CardContent className="py-20 text-center">
                        <p className="text-gray-400 mb-4">No events yet</p>
                        <Button
                            onClick={() => setIsDialogOpen(true)}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            Create Your First Event
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data?.events.map((event) => {
                        const isUpcoming = new Date(event.date) > new Date();
                        return (
                            <div key={event._id} className="relative">
                                {event.isActiveDisplay && (
                                    <div className="absolute -top-2 -right-2 z-10 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30">
                                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                        </svg>
                                    </div>
                                )}
                                <Link href={`/dashboard/events/${event._id}`}>
                                    <div className={`group bg-gradient-to-b from-white/[0.08] to-transparent border rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/5 h-full ${event.isActiveDisplay ? 'border-yellow-500/50 hover:border-yellow-500/70' : 'border-white/10 hover:border-purple-500/30'}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="text-lg font-semibold text-white group-hover:text-purple-300 transition-colors">{event.title}</h3>
                                            <div className="flex items-center gap-2">
                                                {event.isActiveDisplay && (
                                                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                                        Active
                                                    </Badge>
                                                )}
                                                <Badge
                                                    variant={isUpcoming ? 'default' : 'secondary'}
                                                    className={isUpcoming ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}
                                                >
                                                    {isUpcoming ? 'Upcoming' : 'Past'}
                                                </Badge>
                                            </div>
                                        </div>
                                        {event.description && (
                                            <p className="text-gray-500 text-sm line-clamp-2 mb-4">
                                                {event.description}
                                            </p>
                                        )}
                                        <div className="flex items-center text-gray-500 text-sm">
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            {format(new Date(event.date), 'PPP p')}
                                        </div>
                                    </div>
                                </Link>
                                <Button
                                    size="sm"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setActiveMutation.mutate(event._id);
                                    }}
                                    disabled={setActiveMutation.isPending || event.isActiveDisplay}
                                    className={`absolute bottom-4 right-4 ${event.isActiveDisplay ? 'bg-yellow-600/20 text-yellow-400 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700 text-white'} rounded-lg text-xs`}
                                >
                                    {event.isActiveDisplay ? (
                                        <>
                                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                            </svg>
                                            Homepage Active
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                            </svg>
                                            Set as Homepage
                                        </>
                                    )}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
