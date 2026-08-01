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
}: {
    eventId: string;
    className?: string;
}) {
    return (
        <Link
            href={`/dashboard/events/${eventId}`}
            className={cn(
                'inline-flex shrink-0 items-center gap-2 px-4 py-2 bg-foreground text-background hover:bg-foreground/90 text-sm font-medium transition-all',
                className
            )}
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Event
        </Link>
    );
}
