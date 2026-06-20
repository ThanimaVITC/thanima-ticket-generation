'use client';

import { useState } from 'react';
import { LoadingFrame } from '@/components/dot-matrix';
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
import { BoxyFrame } from '@/components/boxy';
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
                <LoadingFrame label="Loading events" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-20">
                <p className="text-rose-300">Failed to load events</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Overview</div>
                    <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">Events</h1>
                    <p className="text-muted-foreground mt-1">Manage your events and attendance</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create Event
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="border-border bg-card/40 text-foreground">
                        <DialogHeader>
                            <DialogTitle>Create New Event</DialogTitle>
                            <DialogDescription className="text-muted-foreground">
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
                                                    className="bg-card border-border text-foreground placeholder:text-muted-foreground"
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
                                                    className="bg-card border-border text-foreground placeholder:text-muted-foreground"
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
                                    disabled={createMutation.isPending}
                                >
                                    {createMutation.isPending ? 'Creating…' : 'Create Event'}
                                </Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <BoxyFrame className="bg-card/40 p-6">
                    <p className="text-muted-foreground text-sm mb-1">Total Events</p>
                    <p className="text-3xl font-bold text-foreground tabular-nums">{data?.pagination.total || 0}</p>
                </BoxyFrame>
                <BoxyFrame className="bg-card/40 p-6">
                    <p className="text-muted-foreground text-sm mb-1">Upcoming</p>
                    <p className="text-3xl font-bold text-foreground tabular-nums">
                        {data?.events.filter((e) => new Date(e.date) > new Date()).length || 0}
                    </p>
                </BoxyFrame>
                <BoxyFrame className="bg-card/40 p-6">
                    <p className="text-muted-foreground text-sm mb-1">Past Events</p>
                    <p className="text-3xl font-bold text-foreground tabular-nums">
                        {data?.events.filter((e) => new Date(e.date) <= new Date()).length || 0}
                    </p>
                </BoxyFrame>
            </div>

            {/* Events List */}
            {data?.events.length === 0 ? (
                <Card className="border-border bg-card/40">
                    <CardContent className="py-20 text-center">
                        <p className="text-muted-foreground mb-4">No events yet</p>
                        <Button
                            onClick={() => setIsDialogOpen(true)}
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
                            <div key={event._id} className="relative group">
                                <Link href={`/dashboard/events/${event._id}`}>
                                    <div className={`flex flex-col h-full border bg-card/40 p-6 transition-all duration-300 ${event.isActiveDisplay ? 'border-border hover:border-border' : 'border-border hover:border-border'}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="text-lg font-semibold text-foreground transition-colors pr-8">{event.title}</h3>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={isUpcoming ? 'secondary' : 'outline'}>
                                                    {isUpcoming ? 'Upcoming' : 'Past'}
                                                </Badge>
                                            </div>
                                        </div>
                                        {event.description && (
                                            <p className="text-muted-foreground text-sm line-clamp-2 mb-4 flex-grow">
                                                {event.description}
                                            </p>
                                        )}
                                        <div className="mt-auto pt-4 flex items-center justify-between border-t border-border">
                                            <div className="flex items-center text-muted-foreground text-sm">
                                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                {format(new Date(event.date), 'MMM d, yyyy')}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    )
}
