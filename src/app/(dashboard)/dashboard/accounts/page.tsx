'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type AccountRole = 'admin' | 'event_admin' | 'app_user';

interface User {
    _id: string;
    name: string;
    email: string;
    role: AccountRole;
    assignedEvents: string[];
    createdAt: string;
}

interface EventItem {
    _id: string;
    title: string;
    date: string;
}

interface CreatedCredentials {
    name: string;
    email: string;
    password: string;
    role: AccountRole;
    assignedEvents: string[];
}

const ROLE_ICONS: Record<AccountRole, React.ReactNode> = {
    admin: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
    ),
    event_admin: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
    ),
    app_user: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
    ),
};

const ROLE_CONFIG: Record<AccountRole, { label: string; color: string; description: string }> = {
    admin: { label: 'Admin', color: 'bg-red-500/20 text-red-400 border-red-500/30', description: 'Full access to everything' },
    event_admin: { label: 'Event Admin', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', description: 'Web + API access to assigned events' },
    app_user: { label: 'App User', color: 'bg-green-500/20 text-green-400 border-green-500/30', description: 'API-only access to assigned events' },
};

const createUserSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

const editUserSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().optional(),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;
type EditUserFormValues = z.infer<typeof editUserSchema>;

async function fetchUsers(): Promise<{ users: User[] }> {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
}

async function fetchEvents(): Promise<{ events: EventItem[] }> {
    const res = await fetch('/api/events?limit=100');
    if (!res.ok) throw new Error('Failed to fetch events');
    return res.json();
}

function generatePassword(length = 12): string {
    const upper = 'ABCDEFGHIJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '!@#$%&*';
    const all = upper + lower + digits + special;

    let pw = '';
    // Ensure at least one from each category
    pw += upper[Math.floor(Math.random() * upper.length)];
    pw += lower[Math.floor(Math.random() * lower.length)];
    pw += digits[Math.floor(Math.random() * digits.length)];
    pw += special[Math.floor(Math.random() * special.length)];

    for (let i = pw.length; i < length; i++) {
        pw += all[Math.floor(Math.random() * all.length)];
    }

    // Shuffle
    return pw.split('').sort(() => Math.random() - 0.5).join('');
}

// --- Copy Button ---
function CopyButton({ text, label }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [text]);

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white"
        >
            {copied ? (
                <>
                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span className="text-green-400">Copied!</span>
                </>
            ) : (
                <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    {label || 'Copy'}
                </>
            )}
        </button>
    );
}

// --- Credential Row in success view ---
function CredentialRow({ label, value, isMono = true }: { label: string; value: string; isMono?: boolean }) {
    return (
        <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className={`text-sm text-white truncate ${isMono ? 'font-mono' : 'font-medium'}`}>{value}</p>
            </div>
            <CopyButton text={value} />
        </div>
    );
}

// --- Event Assigner ---
function EventAssigner({
    allEvents,
    selectedEventIds,
    onChange,
}: {
    allEvents: EventItem[];
    selectedEventIds: string[];
    onChange: (ids: string[]) => void;
}) {
    return (
        <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-300">Assigned Events</Label>
            <div className="max-h-48 overflow-y-auto space-y-1 border border-white/10 rounded-xl p-3 bg-white/5">
                {allEvents.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-2">No events found</p>
                ) : (
                    allEvents.map(event => (
                        <div key={event._id} className="flex items-center space-x-2 py-1">
                            <Checkbox
                                id={`event-${event._id}`}
                                checked={selectedEventIds.includes(event._id)}
                                onCheckedChange={(checked) => {
                                    if (checked) {
                                        onChange([...selectedEventIds, event._id]);
                                    } else {
                                        onChange(selectedEventIds.filter(id => id !== event._id));
                                    }
                                }}
                                className="border-white/20 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                            />
                            <Label
                                htmlFor={`event-${event._id}`}
                                className="text-sm text-gray-400 cursor-pointer select-none flex-1"
                            >
                                {event.title}
                                <span className="text-gray-600 ml-2 text-xs">
                                    {format(new Date(event.date), 'PP')}
                                </span>
                            </Label>
                        </div>
                    ))
                )}
            </div>
            {selectedEventIds.length > 0 && (
                <p className="text-xs text-gray-500">{selectedEventIds.length} event(s) selected</p>
            )}
        </div>
    );
}

export default function AccountsPage() {
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const [createRole, setCreateRole] = useState<AccountRole>('admin');
    const [createAssignedEvents, setCreateAssignedEvents] = useState<string[]>([]);
    const [editRole, setEditRole] = useState<AccountRole>('admin');
    const [editAssignedEvents, setEditAssignedEvents] = useState<string[]>([]);
    const [showPassword, setShowPassword] = useState(false);
    const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

    const { data, isLoading, error } = useQuery({
        queryKey: ['users'],
        queryFn: fetchUsers,
    });

    const { data: eventsData } = useQuery({
        queryKey: ['events-list'],
        queryFn: fetchEvents,
    });

    const allEvents = eventsData?.events || [];

    const createForm = useForm<CreateUserFormValues>({
        resolver: zodResolver(createUserSchema),
        defaultValues: { name: '', email: '', password: '' },
    });

    const editForm = useForm<EditUserFormValues>({
        resolver: zodResolver(editUserSchema),
        defaultValues: { name: '', email: '', password: '' },
    });

    const handleGeneratePassword = useCallback(() => {
        const pw = generatePassword(14);
        createForm.setValue('password', pw);
        setShowPassword(true);
    }, [createForm]);

    const createMutation = useMutation({
        mutationFn: async (data: CreateUserFormValues) => {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
                    role: createRole,
                    assignedEvents: createRole !== 'admin' ? createAssignedEvents : [],
                }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to create user');
            }
            return { response: await res.json(), submittedData: data };
        },
        onSuccess: ({ submittedData }) => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            // Show credentials summary instead of closing
            setCreatedCredentials({
                name: submittedData.name,
                email: submittedData.email,
                password: submittedData.password,
                role: createRole,
                assignedEvents: createAssignedEvents,
            });
            toast({ title: 'Account Created', description: `${submittedData.name} has been created successfully.` });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ userId, data }: { userId: string; data: EditUserFormValues }) => {
            const updateData: Record<string, unknown> = {};
            if (data.name) updateData.name = data.name;
            if (data.email) updateData.email = data.email;
            if (data.password) updateData.password = data.password;
            updateData.role = editRole;
            updateData.assignedEvents = editRole !== 'admin' ? editAssignedEvents : [];

            const res = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to update user');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setEditingUser(null);
            editForm.reset();
            toast({ title: 'User Updated', description: 'Account has been updated' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (userId: string) => {
            const res = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to delete user');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setDeletingUser(null);
            toast({ title: 'User Deleted', description: 'Account has been deleted' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    function openEditDialog(user: User) {
        setEditingUser(user);
        setEditRole(user.role || 'admin');
        setEditAssignedEvents(user.assignedEvents || []);
        editForm.reset({
            name: user.name,
            email: user.email,
            password: '',
        });
    }

    function closeCreateDialog() {
        setIsCreateDialogOpen(false);
        setCreatedCredentials(null);
        createForm.reset();
        setCreateRole('admin');
        setCreateAssignedEvents([]);
        setShowPassword(false);
    }

    // Generate a "Copy All" text block
    function getCopyAllText(creds: CreatedCredentials) {
        const roleLabel = ROLE_CONFIG[creds.role].label;
        let text = `🔐 Account Credentials\n\nName: ${creds.name}\nEmail: ${creds.email}\nPassword: ${creds.password}\nRole: ${roleLabel}\nLogin URL: ${appUrl}/login`;
        if (creds.role !== 'admin' && creds.assignedEvents.length > 0) {
            const eventNames = creds.assignedEvents
                .map(id => allEvents.find(e => e._id === id)?.title || id)
                .join(', ');
            text += `\nAssigned Events: ${eventNames}`;
        }
        return text;
    }

    // Reset create dialog state when it closes
    useEffect(() => {
        if (!isCreateDialogOpen) {
            setCreatedCredentials(null);
            setShowPassword(false);
        }
    }, [isCreateDialogOpen]);

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
                <p className="text-red-400">Failed to load users</p>
            </div>
        );
    }

    const users = data?.users || [];

    const roleCounts = {
        admin: users.filter(u => u.role === 'admin').length,
        event_admin: users.filter(u => u.role === 'event_admin').length,
        app_user: users.filter(u => u.role === 'app_user').length,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Accounts</h1>
                    <p className="text-gray-400 mt-1">Manage user accounts and permissions</p>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
                    if (!open) closeCreateDialog();
                    else setIsCreateDialogOpen(true);
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 shadow-lg shadow-purple-500/25 rounded-xl">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Add Account
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-950 border-white/10 text-white max-w-lg">
                        {createdCredentials ? (
                            /* ======================== */
                            /* SUCCESS: Credentials View */
                            /* ======================== */
                            <>
                                <DialogHeader>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                                            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <div>
                                            <DialogTitle>Account Created!</DialogTitle>
                                            <DialogDescription className="text-gray-500">
                                                Save these credentials — the password won&apos;t be shown again.
                                            </DialogDescription>
                                        </div>
                                    </div>
                                </DialogHeader>

                                <div className="space-y-2 mt-4">
                                    <CredentialRow label="Name" value={createdCredentials.name} isMono={false} />
                                    <CredentialRow label="Email" value={createdCredentials.email} />
                                    <CredentialRow label="Password" value={createdCredentials.password} />
                                    <CredentialRow label="Role" value={ROLE_CONFIG[createdCredentials.role].label} isMono={false} />
                                    <CredentialRow label="Login URL" value={`${appUrl}/login`} />
                                    {createdCredentials.role !== 'admin' && createdCredentials.assignedEvents.length > 0 && (
                                        <CredentialRow
                                            label="Assigned Events"
                                            value={createdCredentials.assignedEvents
                                                .map(id => allEvents.find(e => e._id === id)?.title || id)
                                                .join(', ')}
                                            isMono={false}
                                        />
                                    )}
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1 border-white/10 hover:bg-white/5"
                                        onClick={() => {
                                            navigator.clipboard.writeText(getCopyAllText(createdCredentials));
                                            toast({ title: 'Copied!', description: 'All credentials copied to clipboard.' });
                                        }}
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                        </svg>
                                        Copy All
                                    </Button>
                                    <Button
                                        type="button"
                                        className="flex-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 rounded-xl"
                                        onClick={closeCreateDialog}
                                    >
                                        Done
                                    </Button>
                                </div>
                            </>
                        ) : (
                            /* ================== */
                            /* FORM: Create Account */
                            /* ================== */
                            <>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                            </svg>
                                        </div>
                                        Create Account
                                    </DialogTitle>
                                    <DialogDescription className="text-gray-500">
                                        Set up credentials and assign a role to the new account.
                                    </DialogDescription>
                                </DialogHeader>
                                <Form {...createForm}>
                                    <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                                        <FormField
                                            control={createForm.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-gray-300">Name</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="John Doe"
                                                            className="bg-white/[0.06] border-white/10 focus:border-purple-500/50 transition-colors"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={createForm.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-gray-300">Email</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="email"
                                                            placeholder="user@example.com"
                                                            className="bg-white/[0.06] border-white/10 focus:border-purple-500/50 transition-colors"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={createForm.control}
                                            name="password"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <div className="flex items-center justify-between">
                                                        <FormLabel className="text-gray-300">Password</FormLabel>
                                                        <button
                                                            type="button"
                                                            onClick={handleGeneratePassword}
                                                            className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                            </svg>
                                                            Generate
                                                        </button>
                                                    </div>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Input
                                                                type={showPassword ? 'text' : 'password'}
                                                                placeholder="Min. 6 characters"
                                                                className="bg-white/[0.06] border-white/10 focus:border-purple-500/50 transition-colors pr-10 font-mono"
                                                                {...field}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowPassword(!showPassword)}
                                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                                            >
                                                                {showPassword ? (
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                    </svg>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Role Selector */}
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium text-gray-300">Role</Label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {(Object.entries(ROLE_CONFIG) as [AccountRole, typeof ROLE_CONFIG[AccountRole]][]).map(([key, config]) => (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => setCreateRole(key)}
                                                        className={`p-3 rounded-xl border text-center transition-all duration-200 flex flex-col items-center ${createRole === key
                                                            ? 'border-purple-500/50 bg-purple-500/10 ring-1 ring-purple-500/30'
                                                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20'
                                                            }`}
                                                    >
                                                        <span className={createRole === key ? 'text-purple-400' : 'text-gray-500'}>{ROLE_ICONS[key]}</span>
                                                        <p className={`text-xs font-medium mt-1.5 ${createRole === key ? 'text-white' : 'text-gray-400'}`}>
                                                            {config.label}
                                                        </p>
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-600">{ROLE_CONFIG[createRole].description}</p>
                                        </div>

                                        {/* Event Assignment (shown for non-admin roles) */}
                                        {createRole !== 'admin' && (
                                            <EventAssigner
                                                allEvents={allEvents}
                                                selectedEventIds={createAssignedEvents}
                                                onChange={setCreateAssignedEvents}
                                            />
                                        )}

                                        <Button
                                            type="submit"
                                            className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 rounded-xl h-11 text-sm font-medium"
                                            disabled={createMutation.isPending}
                                        >
                                            {createMutation.isPending ? (
                                                <span className="flex items-center gap-2">
                                                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>
                                                    Creating...
                                                </span>
                                            ) : 'Create Account'}
                                        </Button>
                                    </form>
                                </Form>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
                    <p className="text-gray-500 text-sm mb-1">Total Accounts</p>
                    <p className="text-3xl font-bold text-white">{users.length}</p>
                </div>
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
                    <p className="text-gray-500 text-sm mb-1">Admins</p>
                    <p className="text-3xl font-bold text-red-400">{roleCounts.admin}</p>
                </div>
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
                    <p className="text-gray-500 text-sm mb-1">Event Admins</p>
                    <p className="text-3xl font-bold text-blue-400">{roleCounts.event_admin}</p>
                </div>
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
                    <p className="text-gray-500 text-sm mb-1">App Users</p>
                    <p className="text-3xl font-bold text-green-400">{roleCounts.app_user}</p>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white">All Accounts</h2>
                </div>
                <div className="p-6">
                    {users.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No accounts found</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/10">
                                    <TableHead className="text-gray-500">Name</TableHead>
                                    <TableHead className="text-gray-500">Email</TableHead>
                                    <TableHead className="text-gray-500">Role</TableHead>
                                    <TableHead className="text-gray-500">Events</TableHead>
                                    <TableHead className="text-gray-500">Created</TableHead>
                                    <TableHead className="text-gray-500 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => {
                                    const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.admin;
                                    const assignedCount = user.assignedEvents?.length || 0;
                                    return (
                                        <TableRow key={user._id} className="border-white/10">
                                            <TableCell className="text-white font-medium">{user.name}</TableCell>
                                            <TableCell className="text-gray-400">{user.email}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`${roleConfig.color} border text-xs`}>
                                                    {roleConfig.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-gray-400">
                                                {user.role === 'admin' ? (
                                                    <span className="text-gray-600 text-xs">All events</span>
                                                ) : assignedCount > 0 ? (
                                                    <span className="text-xs">{assignedCount} event(s)</span>
                                                ) : (
                                                    <span className="text-yellow-500 text-xs">None assigned</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-gray-500">
                                                {format(new Date(user.createdAt), 'PP')}
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEditDialog(user)}
                                                    className="text-gray-400 hover:text-white"
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setDeletingUser(user)}
                                                    className="text-red-400 hover:text-red-300"
                                                >
                                                    Delete
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
                <DialogContent className="bg-slate-950 border-white/10 text-white max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </div>
                            Edit Account
                        </DialogTitle>
                        <DialogDescription className="text-gray-500">
                            Update account details, role, and event assignments.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...editForm}>
                        <form
                            onSubmit={editForm.handleSubmit((d) =>
                                editingUser && updateMutation.mutate({ userId: editingUser._id, data: d })
                            )}
                            className="space-y-4"
                        >
                            <FormField
                                control={editForm.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-gray-300">Name</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="John Doe"
                                                className="bg-white/[0.06] border-white/10 focus:border-purple-500/50 transition-colors"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={editForm.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-gray-300">Email</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                placeholder="user@example.com"
                                                className="bg-white/[0.06] border-white/10 focus:border-purple-500/50 transition-colors"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={editForm.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-gray-300">New Password (optional)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder="Leave empty to keep current"
                                                className="bg-white/[0.06] border-white/10 focus:border-purple-500/50 transition-colors"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Role Selector */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-300">Role</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(Object.entries(ROLE_CONFIG) as [AccountRole, typeof ROLE_CONFIG[AccountRole]][]).map(([key, config]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setEditRole(key)}
                                            className={`p-3 rounded-xl border text-center transition-all duration-200 flex flex-col items-center ${editRole === key
                                                ? 'border-purple-500/50 bg-purple-500/10 ring-1 ring-purple-500/30'
                                                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20'
                                                }`}
                                        >
                                            <span className={editRole === key ? 'text-purple-400' : 'text-gray-500'}>{ROLE_ICONS[key]}</span>
                                            <p className={`text-xs font-medium mt-1.5 ${editRole === key ? 'text-white' : 'text-gray-400'}`}>
                                                {config.label}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-600">{ROLE_CONFIG[editRole].description}</p>
                            </div>

                            {/* Event Assignment (shown for non-admin roles) */}
                            {editRole !== 'admin' && (
                                <EventAssigner
                                    allEvents={allEvents}
                                    selectedEventIds={editAssignedEvents}
                                    onChange={setEditAssignedEvents}
                                />
                            )}

                            <div className="flex justify-end space-x-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEditingUser(null)}
                                    className="border-white/10"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 rounded-xl"
                                    disabled={updateMutation.isPending}
                                >
                                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
                <DialogContent className="bg-slate-950 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                            Delete Account
                        </DialogTitle>
                        <DialogDescription className="text-gray-500">
                            Are you sure you want to delete the account for &quot;{deletingUser?.name}&quot;? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end space-x-2 mt-4">
                        <Button variant="outline" onClick={() => setDeletingUser(null)} className="border-white/10">
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deletingUser && deleteMutation.mutate(deletingUser._id)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete Account'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
