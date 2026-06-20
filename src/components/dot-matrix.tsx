import * as React from 'react';
import { cn } from '@/lib/utils';
import { BoxyFrame } from '@/components/boxy';

interface DotMatrixLoaderProps {
    columns?: number;
    rows?: number;
    className?: string;
}

/**
 * A grid of square dots that pulse in a left-to-right wave — the platform's
 * standard loading animation (guideline §8). Pure presentational (no hooks),
 * so it works in both server and client components. The `dot-wave` keyframe
 * lives in globals.css.
 */
export function DotMatrixLoader({ columns = 7, rows = 3, className }: DotMatrixLoaderProps) {
    const dots: Array<{ r: number; c: number }> = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            dots.push({ r, c });
        }
    }

    return (
        <div
            role="status"
            aria-label="Loading"
            className={cn('inline-grid gap-1.5', className)}
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
            {dots.map(({ r, c }) => (
                <span
                    key={`${r}-${c}`}
                    className="h-1.5 w-1.5 bg-foreground"
                    style={{
                        animation: 'dot-wave 1.1s ease-in-out infinite',
                        animationDelay: `${c * 80 + r * 40}ms`,
                    }}
                />
            ))}
        </div>
    );
}

interface LoadingFrameProps {
    label?: string;
    className?: string;
    columns?: number;
    rows?: number;
}

/**
 * The standard full-section loading state: a BoxyFrame containing the dot-matrix
 * wave and an uppercase caption. Use in place of spinners and skeletons.
 */
export function LoadingFrame({ label = 'Loading', className, columns = 7, rows = 3 }: LoadingFrameProps) {
    return (
        <BoxyFrame className={cn('flex flex-col items-center justify-center gap-5 bg-card/40 py-16 px-6', className)}>
            <DotMatrixLoader columns={columns} rows={rows} />
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        </BoxyFrame>
    );
}
