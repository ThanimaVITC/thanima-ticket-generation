'use client';

import { useState } from 'react';

interface ToggleButtonProps {
    label: string;
    active: boolean;
    onToggle: (next: boolean) => Promise<void> | void;
    disabled?: boolean;
    hint?: string;
}

/**
 * A square push-button that reflects and toggles an on/off state.
 * Active = filled near-white (the "pressed/on" state); inactive = outlined.
 * Used for event access controls (ticket download, rotate, food sessions, …).
 */
export function ToggleButton({ label, active, onToggle, disabled, hint }: ToggleButtonProps) {
    const [pending, setPending] = useState(false);

    async function handleClick() {
        if (pending || disabled) return;
        setPending(true);
        try {
            await onToggle(!active);
        } finally {
            setPending(false);
        }
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={disabled || pending}
            aria-pressed={active}
            title={hint}
            className={`group flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50 disabled:pointer-events-none border ${
                active
                    ? 'bg-foreground text-background border-transparent hover:bg-foreground/90'
                    : 'bg-transparent text-foreground border-border hover:bg-accent hover:border-border'
            }`}
        >
            {/* State dot: filled square when on, hollow when off */}
            <span
                className={`inline-block h-2.5 w-2.5 border ${
                    active ? 'bg-background border-background' : 'bg-transparent border-border'
                }`}
            />
            <span>{label}</span>
            <span
                className={`ml-1 text-[10px] uppercase tracking-wider ${
                    active ? 'text-background/60' : 'text-muted-foreground'
                }`}
            >
                {pending ? '…' : active ? 'On' : 'Off'}
            </span>
        </button>
    );
}
