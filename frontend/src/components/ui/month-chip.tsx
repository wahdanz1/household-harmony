import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthChipProps {
    value: string;
    onClick?: () => void;
    className?: string;
}

/**
 * Pill-shaped month picker trigger. Used in page headers next to titles.
 * Renders a calendar icon, the month label, and a chevron.
 */
export const MonthChip = ({ value, onClick, className }: MonthChipProps) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full",
            "bg-surface border border-line",
            "text-sm font-medium text-ink",
            "hover:bg-surface-2 transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            className,
        )}
    >
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{value}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
);
