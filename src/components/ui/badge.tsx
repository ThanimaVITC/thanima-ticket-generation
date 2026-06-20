import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-border bg-card text-muted-foreground",
        secondary:
          "border-border bg-secondary text-secondary-foreground",
        // Status palette (guideline §4.6).
        success:
          "border-emerald-900/60 bg-emerald-900/20 text-emerald-300",
        warning:
          "border-amber-900/60 bg-amber-900/20 text-amber-300",
        destructive:
          "border-rose-900/60 bg-rose-900/20 text-rose-300",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
