'use client';

import { useEffect, useState } from 'react';
import { LoadingFrame } from '@/components/dot-matrix';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';
import { useToast } from '@/hooks/use-toast';

interface User {
    id: string;
    name: string;
    email: string;
    role?: 'admin' | 'event_admin' | 'app_user';
    assignedEvents?: string[];
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [profileOpen, setProfileOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useToast();

    useEffect(() => {
        async function checkAuth() {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    if (data.user?.role === 'app_user') {
                        toast({ title: 'Access Denied', description: 'App users do not have dashboard access.', variant: 'destructive' });
                        router.push('/login');
                        return;
                    }
                    setUser(data.user);
                } else {
                    router.push('/login');
                }
            } catch {
                router.push('/login');
            } finally {
                setIsLoading(false);
            }
        }
        checkAuth();
    }, [router, toast]);

    async function handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            toast({ title: 'Logged out successfully' });
            router.push('/login');
        } catch {
            toast({
                title: 'Logout failed',
                variant: 'destructive',
            });
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <LoadingFrame label="Loading" className="w-full max-w-xs" />
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const isEventContext = pathname.startsWith('/dashboard/events/');
    const eventId = isEventContext ? pathname.split('/')[3] : null;

    let navItems = [];

    if (isEventContext && eventId) {
        navItems = [
            {
                href: '/dashboard',
                label: 'Back to Events',
                icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                ),
                active: false
            },
            {
                href: `/dashboard/events/${eventId}`,
                label: 'Overview',
                icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                ),
                active: pathname === `/dashboard/events/${eventId}`
            },
            {
                href: `/dashboard/events/${eventId}/registrations`,
                label: 'Registrations',
                icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                ),
                active: pathname.includes('/registrations')
            },
            {
                href: `/dashboard/events/${eventId}/template`,
                label: 'Template',
                icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z M4 15l4-4 4 4 3-3 5 5" />
                    </svg>
                ),
                active: pathname.includes('/template')
            },
            {
                href: `/dashboard/events/${eventId}/emails`,
                label: 'Emails',
                icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                ),
                active: pathname.includes('/emails')
            },
            {
                href: `/dashboard/events/${eventId}/food-sessions`,
                label: 'Food',
                icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v7a3 3 0 003 3v8M7 3v7M5 3v7m13-7c-1.657 0-3 2.239-3 5s1.343 5 3 5v6" />
                    </svg>
                ),
                active: pathname.includes('/food-sessions')
            }
        ];
    } else {
        navItems = [
            {
                href: '/dashboard', label: 'Events', icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                ), active: pathname === '/dashboard' || (pathname.startsWith('/dashboard/events') && !isEventContext)
            },
        ];

        // Admins and event admins can see the Accounts page
        if (user.role === 'admin' || user.role === 'event_admin') {
            navItems.push({
                href: '/dashboard/accounts', label: 'Accounts', icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                ), active: pathname === '/dashboard/accounts'
            });
        }
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="relative z-50 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0">
                <div className="max-w-[1200px] mx-auto px-6">
                    <div className="flex justify-between items-center h-16">
                        <Link href="/dashboard" className="flex items-center gap-2.5">
                            <Image
                                src="/thanima_logo.jpg"
                                alt="Thanima"
                                width={28}
                                height={28}
                                className="border border-border"
                            />
                            <span className="text-foreground font-semibold text-lg tracking-tight">Thanima</span>
                        </Link>

                        <nav className="hidden sm:flex items-center gap-1">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`pill flex items-center px-3.5 h-9 text-sm font-medium transition-colors ${item.label === 'Back to Events'
                                        ? 'bg-foreground text-background hover:bg-foreground/90'
                                        : item.active
                                            ? 'bg-secondary text-foreground'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                                        }`}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>

                        <div className="flex items-center gap-2">
                            <ThemeToggle />
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setProfileOpen((o) => !o)}
                                    className="pill flex items-center gap-2 h-9 pl-1 pr-2.5 border border-border bg-card/60 hover:bg-accent transition-colors"
                                >
                                    <span className="size-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-semibold">
                                        {(user.name || user.email || '?').trim().charAt(0).toUpperCase()}
                                    </span>
                                    <span className="hidden sm:block text-sm text-foreground max-w-[140px] truncate">{user.name || user.email}</span>
                                    <svg className={`w-4 h-4 text-muted-foreground transition-transform ${profileOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {profileOpen && (
                                    <>
                                        <button
                                            type="button"
                                            aria-hidden
                                            tabIndex={-1}
                                            className="fixed inset-0 z-40 cursor-default"
                                            onClick={() => setProfileOpen(false)}
                                        />
                                        <div className="absolute right-0 mt-2 w-56 z-50 border border-border bg-popover shadow-xl">
                                            <div className="px-3 py-2.5 border-b border-border">
                                                <p className="text-sm font-medium text-foreground truncate">{user.name || 'Account'}</p>
                                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => { setProfileOpen(false); handleLogout(); }}
                                                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-rose-300 hover:bg-rose-900/20 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                </svg>
                                                Sign out
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile Nav */}
                <div className="sm:hidden border-t border-border px-3 py-2 overflow-x-auto thin-scroll">
                    <nav className="flex items-center gap-1 min-w-max">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`pill flex items-center justify-center px-3 h-9 text-sm font-medium transition-colors ${item.label === 'Back to Events'
                                    ? 'bg-foreground text-background hover:bg-foreground/90'
                                    : item.active
                                        ? 'bg-secondary text-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="relative z-10 max-w-[1200px] mx-auto px-6 py-12">
                {children}
            </main>
        </div>
    );
}
