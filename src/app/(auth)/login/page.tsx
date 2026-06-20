'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { BoxyFrame } from '@/components/boxy';

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    async function onSubmit(data: LoginFormValues) {
        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'Login failed');
            }

            toast({
                title: 'Login Successful',
                description: `Welcome back, ${result.user.name}!`,
            });

            router.push('/dashboard');
            router.refresh();
        } catch (error) {
            toast({
                title: 'Login Failed',
                description: error instanceof Error ? error.message : 'Something went wrong',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="relative z-10 w-full max-w-md">
                {/* Logo & Title */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center justify-center space-x-3 mb-6">
                        <Image
                            src="/thanima_logo.jpg"
                            alt="Thanima Logo"
                            width={48}
                            height={48}
                            className="rounded-xl"
                        />
                    </Link>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
                        Staff
                    </div>
                    <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-2">
                        Welcome Back
                    </h1>
                    <p className="text-muted-foreground">
                        Sign in to manage events and attendance
                    </p>
                </div>

                {/* Login Form Card */}
                <BoxyFrame className="bg-card/40 p-6 sm:p-8">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-muted-foreground text-sm font-medium">Email</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                placeholder="admin@example.com"
                                                className="bg-card border border-border text-foreground placeholder:text-muted-foreground h-12 transition-all"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage className="text-rose-300" />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-muted-foreground text-sm font-medium">Password</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder="••••••••"
                                                className="bg-card border border-border text-foreground placeholder:text-muted-foreground h-12 transition-all"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage className="text-rose-300" />
                                    </FormItem>
                                )}
                            />
                            <Button
                                type="submit"
                                className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 font-semibold text-base transition-all"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Signing in…' : 'Sign In'}
                            </Button>
                        </form>
                    </Form>
                </BoxyFrame>

                {/* Back to Home Link */}
                <div className="text-center mt-6">
                    <Link
                        href="/"
                        className="text-muted-foreground hover:text-muted-foreground text-sm transition-colors inline-flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
