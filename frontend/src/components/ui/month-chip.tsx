import { forwardRef } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    value: string;
}

/**
 * Pill-shaped month picker trigger. Used in page headers next to titles.
 * Renders a calendar icon, the month label, and a chevron.
 */
export const MonthChip = forwardRef<HTMLButtonElement, MonthChipProps>(
    ({ value, className, ...props }, ref) => (
        <button
            ref={ref}
            type="button"
            className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full",
                "bg-surface border border-line",
                "text-sm font-medium text-ink",
                "hover:bg-surface-2 transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                className,
            )}
            {...props}
        >
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{value}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
    ),
);
MonthChip.displayName = "MonthChip";
