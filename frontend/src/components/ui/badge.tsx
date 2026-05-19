/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent text-accent-ink hover:bg-accent/80",
        secondary: "border-transparent bg-surface-2 text-ink hover:bg-surface-2/80",
        destructive: "border-transparent bg-danger text-accent-ink hover:bg-danger/80",
        outline: "text-ink",
        soft: "bg-accent/10 text-accent border-accent/20",
        success: "bg-accent/10 text-accent border-accent/30",
        warning: "bg-warn/10 text-warn border-warn/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
