import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Money } from "@/components/ui/money";

interface MetricTileProps {
    icon: LucideIcon;
    label: string;
    primary: number;
    primaryLabel?: string;
    secondary?: string;
    /** Item count shown top-right (e.g. "6 subscriptions") */
    count?: number;
    /** Progress 0-1 — renders progress bar instead of secondary text */
    progress?: number;
    /** "accent" tile gets the soft-accent background treatment */
    tone?: "default" | "accent";
    currency?: string;
    onClick?: () => void;
}

/**
 * Overview metric tile (Subscriptions / Insurance / Credit cards / Co-parent).
 * 4-tile grid on desktop, 2x2 on mobile.
 */
export const MetricTile = ({
    icon: Icon,
    label,
    primary,
    primaryLabel,
    secondary,
    count,
    progress,
    tone = "default",
    currency = "SEK",
    onClick,
}: MetricTileProps) => {
    const isAccent = tone === "accent";
    const labelColor = isAccent ? "text-accent-dk" : "text-muted-foreground";
    const valueColor = isAccent ? "text-accent-dk" : "text-ink";

    return (
        <div
            onClick={onClick}
            className={cn(
                "rounded-[14px] border p-4 flex flex-col gap-2.5 min-h-[124px]",
                "transition-colors",
                isAccent
                    ? "bg-accent-tint border-transparent"
                    : "bg-surface border-line hover:bg-surface-2",
                onClick && "cursor-pointer",
            )}
        >
            <div className="flex items-center justify-between">
                <div
                    className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center",
                        isAccent ? "bg-accent/15 text-accent-dk" : "bg-surface-2 text-ink-2",
                    )}
                >
                    <Icon className="h-[15px] w-[15px]" strokeWidth={1.8} />
                </div>
                {count !== undefined && (
                    <span className="text-[11.5px] font-semibold text-muted-foreground tabular-nums">
                        {count}
                    </span>
                )}
            </div>

            <div>
                <div className={cn("text-[12.5px] font-medium", labelColor)}>{label}</div>
                <div className="mt-1">
                    <Money v={primary} currency={currency} size="base" weight={600} className={valueColor} />
                </div>
                {primaryLabel && (
                    <div className={cn("mt-0.5 text-[11.5px]", labelColor)}>{primaryLabel}</div>
                )}
            </div>

            {progress !== undefined ? (
                <div className="mt-auto h-1.5 bg-line-2 rounded-full overflow-hidden">
                    <div
                        className={cn(
                            "h-full rounded-full transition-[width] duration-300",
                            progress > 0.8 ? "bg-warn" : "bg-accent",
                        )}
                        style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
                    />
                </div>
            ) : (
                secondary && (
                    <div className={cn("mt-auto text-[11.5px]", labelColor)}>{secondary}</div>
                )
            )}
        </div>
    );
};
