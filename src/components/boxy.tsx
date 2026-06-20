import * as React from 'react';
import { cn } from '@/lib/utils';

/** A single crosshair (+) marker sitting just outside a frame corner. */
function PlusMark({ className }: { className?: string }) {
    return (
        <span aria-hidden className={cn('pointer-events-none absolute z-10 h-[11px] w-[11px] text-grid-line-strong', className)}>
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current" />
            <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-current" />
        </span>
    );
}

/**
 * The signature grouped-block element: a thin square border with four crosshair
 * markers ~6px outside each corner. Never wrap with overflow-hidden — it clips
 * the markers; clip inner content instead.
 */
export function BoxyFrame({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn('boxy-frame', className)} {...props}>
            <PlusMark className="-top-[6px] -left-[6px]" />
            <PlusMark className="-top-[6px] -right-[6px]" />
            <PlusMark className="-bottom-[6px] -left-[6px]" />
            <PlusMark className="-bottom-[6px] -right-[6px]" />
            {children}
        </div>
    );
}

export { PlusMark };
