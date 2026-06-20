'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Single-button theme toggle (sun ↔ moon). Persists to localStorage and toggles
 * the `dark` class on <html>. No dropdown — one click flips the theme.
 */
export function ThemeToggle() {
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        setIsDark(document.documentElement.classList.contains('dark'));
    }, []);

    function toggle() {
        const next = !isDark;
        setIsDark(next);
        const root = document.documentElement;
        if (next) {
            root.classList.add('dark');
            try { localStorage.setItem('theme', 'dark'); } catch {}
        } else {
            root.classList.remove('dark');
            try { localStorage.setItem('theme', 'light'); } catch {}
        }
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Toggle theme"
            title="Toggle theme"
            className="pill"
        >
            {isDark ? (
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36 6.36l-1.42-1.42M6.34 6.34L4.93 4.93m12.73 0l-1.42 1.42M6.34 17.66l-1.41 1.41M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            ) : (
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
            )}
        </Button>
    );
}
