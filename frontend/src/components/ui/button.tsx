import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button — chlorophyll system
 *
 * Variants: primary, secondary, ghost, destructive, accentSoft, link, outline (legacy alias)
 * Sizes:    sm (36×rounded-10), default/md (44×rounded-12), lg (52×rounded-14), icon (44×44)
 *
 * The primary variant is the only one that uses the saturated accent fill.
 * `accentSoft` is the soft-accent variant for empty-state CTAs and secondary affordances.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold tracking-tight",
    "transition-all duration-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "active:translate-y-[1px]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-ink border border-accent-dk hover:bg-accent/90",
        secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
        ghost: "bg-transparent text-ink border border-transparent hover:bg-surface-2",
        destructive: "bg-surface text-danger border border-line hover:bg-danger/10",
        accentSoft: "bg-accent-tint text-accent-dk border border-transparent hover:bg-accent-tint/80",
        link: "text-accent-dk underline-offset-4 hover:underline border-transparent bg-transparent",

        // Legacy aliases — keep call sites working during migration
        default: "bg-accent text-accent-ink border border-accent-dk hover:bg-accent/90",
        outline: "bg-surface text-ink border border-line hover:bg-surface-2",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px] rounded-[10px]",
        default: "h-11 px-4 text-[15px] rounded-[12px]",
        md: "h-11 px-4 text-[15px] rounded-[12px]",
        lg: "h-[52px] px-5 text-base rounded-[14px]",
        icon: "h-11 w-11 rounded-[12px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
