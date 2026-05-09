import * as React from "react";
import { cn } from "@/lib/utils";

interface RowItemProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Set to true on the final row in a list to suppress the bottom divider. */
    last?: boolean;
    /** Disable the divider entirely (e.g. for cards with their own internal structure). */
    noDivider?: boolean;
}

/**
 * Flush row used inside a list-style card. No own border or background;
 * vertical separation comes from a bottom hairline (`--line-2`) that
 * suppresses on the last item.
 *
 * Use inside `<Card variant="flush">` or any container that owns the outer
 * border. Items render as a single connected list with thin separators —
 * the design's intended treatment for income sources, expense rows,
 * recent activity, etc.
 */
export const RowItem = React.forwardRef<HTMLDivElement, RowItemProps>(
    ({ last, noDivider, onClick, className, children, ...props }, ref) => (
        <div
            ref={ref}
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5",
                !last && !noDivider && "border-b border-line-2",
                onClick && "cursor-pointer hover:bg-surface-2 transition-colors",
                className,
            )}
            {...props}
        >
            {children}
        </div>
    ),
);
RowItem.displayName = "RowItem";
