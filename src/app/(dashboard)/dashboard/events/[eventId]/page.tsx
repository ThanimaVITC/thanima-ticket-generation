'use client';

import { useState, use, useRef, useMemo } from 'react';
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
import { downloadCsv, downloadXlsx, downloadChartPng, exportFileName } from '@/lib/table-export';

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

interface FoodSessionSummary {
    _id: string;
    colorName: string;
    colorHex: string;
    count: number;
    served: number;
}

interface FoodAssignmentRow {
    email: string;
    colorName: string;
    servedAt: string | null;
}

interface FoodAssignmentsResponse {
    assignments: FoodAssignmentRow[];
}

async function fetchFoodAssignments(eventId: string): Promise<FoodAssignmentsResponse> {
    const res = await fetch(`/api/events/${eventId}/food-assignments`);
    if (!res.ok) throw new Error('Failed to fetch food assignments');
    return res.json();
}

interface TicketTemplate {
    imagePath?: string;
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
    userPoolEnabled?: boolean;
    unpaidEnabled?: boolean;
    logoPath?: string;
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



/**
 * The frame every chart on this page sits in: title, a "save as PNG" action, and the
 * empty state. The PNG is read straight off the rendered SVG, so it always matches
 * what is on screen.
 */
function ChartCard({
    title,
    note,
    fileName,
    hasData,
    empty,
    children,
}: {
    title: string;
    note?: string;
    fileName: string;
    hasData: boolean;
    empty: string;
    children: React.ReactNode;
}) {
    const chartRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    const savePng = async () => {
        const svg = chartRef.current?.querySelector('svg');
        if (!svg) return;
        try {
            await downloadChartPng(svg as SVGSVGElement, fileName);
        } catch {
            toast({ title: 'Could not save the chart', description: 'Try again once it has finished drawing.', variant: 'destructive' });
        }
    };

    return (
        <BoxyFrame className="bg-card/40 p-6 min-w-0">
            <div className="flex items-baseline justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <div className="flex items-baseline gap-3">
                    {note && <span className="text-xs text-muted-foreground">{note}</span>}
                    {hasData && (
                        <button
                            type="button"
                            onClick={savePng}
                            className="text-xs border border-border px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                            PNG ↓
                        </button>
                    )}
                </div>
            </div>
            {hasData ? (
                <div ref={chartRef} className="h-[300px] w-full min-w-0 overflow-hidden">
                    {children}
                </div>
            ) : (
                <div className="h-[240px] flex items-center justify-center text-muted-foreground">
                    {empty}
                </div>
            )}
        </BoxyFrame>
    );
}

/**
 * Every single-series bar on this page — registrations by year, email status, unpaid by
 * year — is the same chart with a different title and noun, so it is written once.
 */
function SimpleBarCard({
    title,
    data,
    unit,
    empty,
    fileName,
    labelPrefix = '',
}: {
    title: string;
    data: { name: string; value: number }[];
    unit: string;
    empty: string;
    fileName: string;
    labelPrefix?: string;
}) {
    const total = data.reduce((sum, x) => sum + x.value, 0);
    return (
        <ChartCard title={title} fileName={fileName} hasData={data.length > 0} empty={empty}>
            <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.22)" vertical={false} />
                        <XAxis dataKey="name" stroke="rgba(120,120,120,0.45)" tick={{ fill: '#6a6b6c', fontSize: 12 }} axisLine={{ stroke: 'rgba(120,120,120,0.28)' }} />
                        <YAxis stroke="rgba(120,120,120,0.45)" tick={{ fill: '#6a6b6c', fontSize: 12 }} axisLine={{ stroke: 'rgba(120,120,120,0.28)' }} tickLine={{ stroke: 'rgba(120,120,120,0.28)' }} />
                    <Tooltip
                        cursor={{ fill: 'rgba(120,120,120,0.14)' }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                const percent = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0';
                                return (
                                    <div className="bg-popover border border-border px-3 py-2">
                                        <p className="text-foreground font-medium">{labelPrefix}{d.name}</p>
                                        <p className="text-muted-foreground text-sm">{d.value} {unit} ({percent}%)</p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar dataKey="value">
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    );
}

interface FoodSlotDatum {
    name: string;
    hex: string;
    scanned: number;
    pending: number;
    assigned: number;
}

/**
 * One bar per slot, its height the number assigned. The eaten share is filled with the
 * slot's own colour and the rest stays grey, so the gap between "given a colour" and
 * "actually fed" is the visible part of the bar.
 */
function FoodSlotCard({ data, fileName }: { data: FoodSlotDatum[]; fileName: string }) {
    return (
        <ChartCard
            title="Food Slots"
            note="Coloured = scanned"
            fileName={fileName}
            hasData={data.length > 0}
            empty="No food slots yet"
        >
            <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.22)" vertical={false} />
                        <XAxis dataKey="name" stroke="rgba(120,120,120,0.45)" tick={{ fill: '#6a6b6c', fontSize: 12 }} axisLine={{ stroke: 'rgba(120,120,120,0.28)' }} />
                        <YAxis stroke="rgba(120,120,120,0.45)" tick={{ fill: '#6a6b6c', fontSize: 12 }} axisLine={{ stroke: 'rgba(120,120,120,0.28)' }} tickLine={{ stroke: 'rgba(120,120,120,0.28)' }} />
                    <Tooltip
                        cursor={{ fill: 'rgba(120,120,120,0.14)' }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload as FoodSlotDatum;
                                const percent = d.assigned > 0 ? ((d.scanned / d.assigned) * 100).toFixed(1) : '0.0';
                                return (
                                    <div className="bg-popover border border-border px-3 py-2">
                                        <p className="text-foreground font-medium">{d.name}</p>
                                        <p className="text-muted-foreground text-sm">{d.assigned} assigned</p>
                                        <p className="text-muted-foreground text-sm">{d.scanned} scanned ({percent}%)</p>
                                        <p className="text-muted-foreground text-sm">{d.pending} yet to eat</p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar dataKey="scanned" stackId="slot">
                        {data.map((entry, index) => (
                            <Cell key={`scanned-${index}`} fill={entry.hex} />
                        ))}
                    </Bar>
                    <Bar dataKey="pending" stackId="slot" fill="rgba(120,120,120,0.22)" />
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    );
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
    const [isExportingXlsx, setIsExportingXlsx] = useState(false);
    const [isLogoDialogOpen, setIsLogoDialogOpen] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);
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
        foodSlot: false,
        foodScanned: false,
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

    // Food slots live in their own collection, so the applicant export joins them in
    // here rather than widening the event payload for every page that never needs it.
    const foodEnabled = data?.event.foodSessionsEnabled ?? false;
    const { data: foodData } = useQuery({
        queryKey: ['food-assignments', eventId],
        queryFn: () => fetchFoodAssignments(eventId),
        enabled: foodEnabled,
    });

    const { data: unpaidData } = useQuery({
        queryKey: ['unpaid', eventId],
        queryFn: async (): Promise<{ entries: { regNo: string }[] }> => {
            const res = await fetch(`/api/events/${eventId}/unpaid`);
            if (!res.ok) throw new Error('Failed to fetch the unpaid list');
            return res.json();
        },
        enabled: data?.event.unpaidEnabled ?? false,
    });

    // Same query key the food sessions page uses, so this shares its cache.
    const { data: foodSessionData } = useQuery({
        queryKey: ['food-sessions', eventId],
        queryFn: async (): Promise<{ sessions: FoodSessionSummary[] }> => {
            const res = await fetch(`/api/events/${eventId}/food-sessions`);
            if (!res.ok) throw new Error('Failed to fetch food sessions');
            return res.json();
        },
        enabled: foodEnabled,
    });

    const foodByEmail = useMemo(
        () => new Map((foodData?.assignments ?? []).map((a) => [a.email.toLowerCase(), a])),
        [foodData]
    );

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

    // Event logo: pass a File to upload/replace, or null to remove it.
    const logoMutation = useMutation({
        mutationFn: async (file: File | null) => {
            let init: RequestInit = { method: 'DELETE' };
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                init = { method: 'POST', body: formData };
            }
            const res = await fetch(`/api/events/${eventId}/logo`, init);
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to update logo');
            }
            return res.json();
        },
        onSuccess: (_data, file) => {
            queryClient.invalidateQueries({ queryKey: ['event', eventId] });
            if (logoInputRef.current) logoInputRef.current.value = '';
            toast({ title: file ? 'Logo Updated' : 'Logo Removed' });
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
        ...(foodEnabled ? { foodSlot: 'Food Slot', foodScanned: 'Food Scanned' } : {}),
    };

    // Attendance only. Filtering by slot or scan state is the food sessions page's job —
    // this dialog just carries the columns.
    const getFilteredRegistrations = (regs: Registration[]) => {
        if (attendanceFilter === 'attended') return regs.filter(r => r.attended);
        if (attendanceFilter === 'not_attended') return regs.filter(r => !r.attended);
        return regs;
    };

    const buildDownloadTable = () => {
        if (!data) return null;
        const filtered = getFilteredRegistrations(data.registrations);
        // Driven off the labels, not the state, so hidden food columns can never be
        // exported by a stale "select all" on an event without food sessions.
        const selectedFields = Object.keys(downloadFieldLabels).filter(k => downloadFields[k]);
        if (selectedFields.length === 0) return null;

        const headers = selectedFields.map(f => downloadFieldLabels[f]);
        const rows = filtered.map(reg => {
            const food = foodByEmail.get(reg.email.toLowerCase());
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
                    case 'foodSlot': return food?.colorName || '';
                    case 'foodScanned': return food?.servedAt ? 'Yes' : 'No';
                    default: return '';
                }
            });
        });

        return { headers, rows, fileName: exportFileName(data.event.title, 'applicants') };
    };

    const handleDownloadCsv = () => {
        const table = buildDownloadTable();
        if (!table) return;
        downloadCsv(table.headers, table.rows, table.fileName);
        setIsDownloadDialogOpen(false);
    };

    const handleDownloadXlsx = async () => {
        const table = buildDownloadTable();
        if (!table) return;
        setIsExportingXlsx(true);
        try {
            await downloadXlsx(table.headers, table.rows, table.fileName, { sheetName: 'Applicants' });
            setIsDownloadDialogOpen(false);
        } catch {
            toast({ title: 'Excel export failed', description: 'Try CSV instead.', variant: 'destructive' });
        } finally {
            setIsExportingXlsx(false);
        }
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
    // Slimmer variant for the actions row so five buttons fit on one line.
    const actionCell = 'flex items-center justify-center gap-2 px-1.5 py-3.5 text-xs sm:text-[13px] font-medium text-center border-l border-t border-border transition-colors';

    // "25BCE1043" -> "2025". Shared by the registration and unpaid year charts.
    const yearOf = (regNo: string) => {
        const match = regNo.match(/^(\d{2})/);
        return match ? `20${match[1]}` : 'Unknown';
    };

    const regNoByYear = registrations.reduce((acc, reg) => {
        const year = yearOf(reg.regNo);
        acc[year] = (acc[year] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const regNoData = Object.entries(regNoByYear)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.name.localeCompare(a.name));

    const unpaidYearData = Object.entries(
        (unpaidData?.entries ?? []).reduce((acc, entry) => {
            const year = yearOf(entry.regNo);
            acc[year] = (acc[year] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    )
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.name.localeCompare(a.name));

    const foodSlotData = (foodSessionData?.sessions ?? []).map((session) => ({
        name: session.colorName,
        hex: session.colorHex,
        scanned: session.served ?? 0,
        pending: Math.max(0, session.count - (session.served ?? 0)),
        assigned: session.count,
    }));

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
                                        Delete &quot;{event.title}&quot;? This also deletes its registrations,
                                        attendance, food sessions and scans, user pool history, and the
                                        unpaid list. This action cannot be undone.
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
                <div>
                    <div className="-mt-px -ml-px">
                        {/* Toggles — on = green, off = red */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
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
                            <button type="button" onClick={() => patchSettings({ userPoolEnabled: !event.userPoolEnabled }, event.userPoolEnabled ? 'User Pool Disabled' : 'User Pool Enabled')} className={`${cell} text-white ${event.userPoolEnabled ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-rose-600 hover:bg-rose-600'}`}>
                                <span>User Pool</span>
                                <span className="pill bg-white text-black font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">{event.userPoolEnabled ? 'On' : 'Off'}</span>
                            </button>
                            <button type="button" onClick={() => patchSettings({ unpaidEnabled: !event.unpaidEnabled }, event.unpaidEnabled ? 'Unpaid List Disabled' : 'Unpaid List Enabled')} className={`${cell} text-white ${event.unpaidEnabled ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-rose-600 hover:bg-rose-600'}`}>
                                <span>Unpaid</span>
                                <span className="pill bg-white text-black font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">{event.unpaidEnabled ? 'On' : 'Off'}</span>
                            </button>
                        </div>
                        {/* Actions — inverted (theme-flipped). Slimmer cells so all fit one row with the Picker. */}
                        <div className={`grid grid-cols-3 ${canEditEvent ? 'sm:grid-cols-6' : 'sm:grid-cols-4'}`}>
                            <button type="button" onClick={() => setIsManualDialogOpen(true)} className={`${actionCell} bg-foreground text-background hover:bg-foreground/90`}>
                                <span>Add Reg</span>
                            </button>
                            <Link href={`/dashboard/events/${eventId}/registrations/upload`} className={`${actionCell} bg-foreground text-background hover:bg-foreground/90`}>
                                <span>Upload</span>
                            </Link>
                            <button type="button" onClick={() => setIsDownloadDialogOpen(true)} className={`${actionCell} bg-foreground text-background hover:bg-foreground/90`}>
                                <span>Download</span>
                            </button>
                            <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ['event', eventId] })} className={`${actionCell} bg-foreground text-background hover:bg-foreground/90`}>
                                <span>Refresh</span>
                            </button>
                            {canEditEvent && (
                                <Link href={`/random-picker/${eventId}`} target="_blank" rel="noopener noreferrer" className={`${actionCell} bg-foreground text-background hover:bg-foreground/90`}>
                                    <span>Picker</span>
                                </Link>
                            )}
                            {canEditEvent && (
                                <button type="button" onClick={() => setIsLogoDialogOpen(true)} className={`${actionCell} bg-foreground text-background hover:bg-foreground/90`}>
                                    <span>Logo</span>
                                </button>
                            )}
                        </div>
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

            {/* Event logo dialog (opened from the grid) */}
            <Dialog open={isLogoDialogOpen} onOpenChange={setIsLogoDialogOpen}>
                <DialogContent className="bg-popover border border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Event Logo</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Shown on the public homepage and sent with the event API for the app.
                            PNG, JPG or WEBP.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center gap-4">
                        <div className="size-24 shrink-0 border border-border bg-card flex items-center justify-center overflow-hidden">
                            {event.logoPath ? (
                                // Presigned S3 URL — plain <img> so next/image needs no remote host allow-list.
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={event.logoPath} alt="Event logo" className="size-full object-cover" />
                            ) : (
                                <span className="text-xs text-muted-foreground">No logo</span>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) logoMutation.mutate(file);
                                }}
                            />
                            <Button onClick={() => logoInputRef.current?.click()} disabled={logoMutation.isPending}>
                                {logoMutation.isPending ? 'Working…' : event.logoPath ? 'Replace Logo' : 'Upload Logo'}
                            </Button>
                            {event.logoPath && (
                                <Button variant="destructive" onClick={() => logoMutation.mutate(null)} disabled={logoMutation.isPending}>
                                    Remove
                                </Button>
                            )}
                        </div>
                    </div>
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
                                        const keys = Object.keys(downloadFieldLabels);
                                        const allSelected = keys.every(k => downloadFields[k]);
                                        setDownloadFields(prev => ({
                                            ...prev,
                                            ...Object.fromEntries(keys.map(k => [k, !allSelected])),
                                        }));
                                    }}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {Object.keys(downloadFieldLabels).every(k => downloadFields[k]) ? 'Deselect All' : 'Select All'}
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

                        <div className="grid sm:grid-cols-2 gap-3 mt-4">
                            <button
                                type="button"
                                disabled={isExportingXlsx || !Object.keys(downloadFieldLabels).some(k => downloadFields[k])}
                                onClick={handleDownloadCsv}
                                className="border border-border p-4 text-left hover:bg-accent transition-colors disabled:opacity-50"
                            >
                                <div className="font-medium text-foreground">CSV</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Plain text. Opens anywhere — Excel, Sheets, Numbers.
                                </p>
                            </button>
                            <button
                                type="button"
                                disabled={isExportingXlsx || !Object.keys(downloadFieldLabels).some(k => downloadFields[k])}
                                onClick={handleDownloadXlsx}
                                className="border border-border p-4 text-left hover:bg-accent transition-colors disabled:opacity-50"
                            >
                                <div className="font-medium text-foreground">
                                    {isExportingXlsx ? 'Preparing…' : 'Excel (.xlsx)'}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Real workbook with sized columns. Slightly slower to build.
                                </p>
                            </button>
                        </div>
                    </DialogContent>
            </Dialog>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SimpleBarCard
                    title="Registrations by Year"
                    fileName={exportFileName(event.title, 'registrations_by_year')}
                    data={regNoData}
                    unit="registrations"
                    labelPrefix="Year: "
                    empty="No registration data available"
                />

                <SimpleBarCard
                    title="Email Status"
                    fileName={exportFileName(event.title, 'email_status')}
                    data={emailData}
                    unit="emails"
                    empty="No email data available"
                />

                {/* Both of these are feature-gated: no unpaid list, no unpaid chart. */}
                {event.unpaidEnabled && (
                    <SimpleBarCard
                        title="Unpaid by Year"
                        fileName={exportFileName(event.title, 'unpaid_by_year')}
                        data={unpaidYearData}
                        unit="unpaid"
                        labelPrefix="Year: "
                        empty="Nobody on the unpaid list yet"
                    />
                )}

                {foodEnabled && (
                    <FoodSlotCard data={foodSlotData} fileName={exportFileName(event.title, 'food_slots')} />
                )}
            </div>
        </div>
    );
}
