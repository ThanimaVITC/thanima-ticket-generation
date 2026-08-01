import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The "leave this sub-page" action, shared by every event sub-page.
 *
 * `bg-foreground text-background` is the theme-inverting pair: black on white
 * in light mode, white on black in dark. Pass `className` to reshape it for a
 * grid cell — cn() resolves the Tailwind conflicts so overrides actually win.
 */
export function BackToEvent({
    eventId,
    className,
    label = 'Back to Event',
}: {
    eventId: string;
    className?: string;
    label?: string;
}) {
    return (
        <Link
            href={`/dashboard/events/${eventId}`}
            className={cn(
                'inline-flex shrink-0 items-center gap-2 px-4 py-2 bg-foreground text-background hover:bg-foreground/90 text-sm font-medium transition-all',
                className
            )}
        >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {label}
        </Link>
    );
}

/* ------------------------------------------------------------------ */
/* Shared cell styling for the title cards on the event sub-pages.     */
/* Registrations set the pattern; Emails, Food and Unpaid follow it.   */
/* ------------------------------------------------------------------ */

/** A cell in the strip under a page title. */
export const headerCell =
    'flex items-center justify-center px-4 py-3.5 text-sm font-medium text-foreground border-l border-t border-border transition-colors';

/** A read-only "Label : value" cell. */
export const headerStatCell = `${headerCell} gap-1.5 px-3`;

/** A cell that acts as a primary button — the whole cell is the control. */
export const headerActionCell = `${headerCell} justify-center bg-foreground text-background hover:bg-foreground/90`;

/**
 * A cell that creates something new. Emerald, matching the "on" state of the
 * access toggles on the event hub — the one place solid colour is used.
 */
export const headerCreateCell = `${headerCell} justify-center bg-emerald-600 text-white hover:bg-emerald-500`;
