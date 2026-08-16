import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * A "go back up" action with the shared chevron. Pages two levels deep stack several
 * of these so the whole trail is one click away, rather than making staff walk up.
 *
 * `bg-foreground text-background` is the theme-inverting pair: black on white
 * in light mode, white on black in dark. Pass `className` to reshape it for a
 * grid cell — cn() resolves the Tailwind conflicts so overrides actually win.
 */
export function BackLink({
    href,
    label,
    className,
}: {
    href: string;
    label: string;
    className?: string;
}) {
    return (
        <Link
            href={href}
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

/** The common case: back to this event's hub. */
export function BackToEvent({
    eventId,
    className,
    label = 'Back to Event',
}: {
    eventId: string;
    className?: string;
    label?: string;
}) {
    return <BackLink href={`/dashboard/events/${eventId}`} label={label} className={className} />;
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

/**
 * A cell for the colour mailing entry point. The spectrum is the label: this is the one
 * action in the app that is *about* the colours, so it wears them instead of the
 * theme-inverting black/white every other action cell uses.
 */
export const headerGradientCell =
    `${headerCell} justify-center text-white border-l-0 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500 hover:brightness-110`;
