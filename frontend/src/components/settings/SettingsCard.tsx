import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SettingsCardProps {
    /** Uppercase eyebrow label (e.g. "THEME", "LANGUAGE"). */
    eyebrow: string;
    /** Optional small node rendered right-aligned in the eyebrow row (count, status, etc.). */
    eyebrowRight?: ReactNode;
    children: ReactNode;
    /** Soft-disabled appearance for not-yet-shipped sections. */
    dim?: boolean;
    /**
     * Visual tone. "danger" tints the eyebrow + border red for destructive
     * sections (e.g., Danger Zone with Reset Data).
     */
    tone?: "default" | "danger";
    className?: string;
    /**
     * Override CardContent classes. Default `p-5` for prose content.
     * Use `"p-0"` when children is a <SettingsList> so rows + dividers
     * go edge-to-edge.
     */
    contentClassName?: string;
}

export const SettingsCard = ({ eyebrow, eyebrowRight, children, dim, tone = "default", className, contentClassName }: SettingsCardProps) => (
    <Card
        variant="flush"
        className={cn(
            dim && "opacity-70 pointer-events-none select-none",
            tone === "danger" && "border-danger/40",
            className,
        )}
    >
        <CardHeader className={cn(
            "p-0 space-y-0 border-b border-line-2 flex-row items-center justify-between",
            tone === "danger" && "border-danger/30",
        )}>
            <p className={cn(
                "px-5 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] leading-[1.5]",
                tone === "danger" ? "text-danger" : "text-muted",
            )}>
                {eyebrow}
            </p>
            {eyebrowRight && (
                <div className="px-5 py-2.5 text-[11.5px] font-semibold text-muted tabular-nums leading-[1.5]">
                    {eyebrowRight}
                </div>
            )}
        </CardHeader>
        <CardContent className={cn("mt-0", contentClassName ?? "p-5")}>{children}</CardContent>
    </Card>
);

interface SettingsRowProps {
    title: string;
    description?: ReactNode;
    /** Right-side interactive element (toggle, button, badge). */
    control?: ReactNode;
    /** Inline badge next to the title (e.g. "Active", "Coming soon"). */
    badge?: ReactNode;
}

/**
 * Title + description + right-aligned control row, used inside SettingsCard.
 */
export const SettingsRow = ({ title, description, control, badge }: SettingsRowProps) => (
    <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-ink leading-tight">{title}</p>
                {badge}
            </div>
            {description && (
                <p className="text-sm text-muted mt-1">{description}</p>
            )}
        </div>
        {control && <div className="shrink-0">{control}</div>}
    </div>
);

interface SettingsListProps {
    children: ReactNode;
    className?: string;
}

/**
 * Container for stacked SettingsListItem rows inside a SettingsCard.
 * Use inside <CardContent className="p-0"> so rows go edge-to-edge.
 */
export const SettingsList = ({ children, className }: SettingsListProps) => (
    <div className={cn("divide-y divide-line-2", className)}>{children}</div>
);

interface SettingsListItemProps {
    title: string;
    /** Current value or descriptive sub-line. Wraps by default. */
    value?: ReactNode;
    /** Inline badge next to the title. */
    badge?: ReactNode;
    /** Right-side element (toggle, custom node). When set with onClick, the
     *  chevron is suppressed in favour of the control. */
    control?: ReactNode;
    /** Click handler — opens a dialog or triggers an action. Renders chevron. */
    onClick?: () => void;
    /** Optional leading icon node (e.g. lucide-react). */
    icon?: ReactNode;
    disabled?: boolean;
}

/**
 * Row inside a SettingsList. Two flavours:
 * - With onClick: clickable row with hover + chevron (click-to-edit).
 * - With control: right-side toggle/button, no chevron.
 */
export const SettingsListItem = ({
    title,
    value,
    badge,
    control,
    onClick,
    icon,
    disabled,
}: SettingsListItemProps) => {
    const isClickable = !!onClick && !disabled;
    const showChevron = isClickable && !control;
    const inner = (
        <>
            {icon && <div className="shrink-0 text-muted self-start mt-0.5">{icon}</div>}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-ink leading-tight">{title}</p>
                    {badge}
                </div>
                {value && <div className="text-sm text-muted mt-1">{value}</div>}
            </div>
            <div className="shrink-0 flex items-center gap-2 self-center">
                {control}
                {showChevron && <ChevronRight className="h-4 w-4 text-muted" />}
            </div>
        </>
    );

    if (isClickable) {
        return (
            <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                className="w-full flex items-start justify-between gap-4 px-5 py-3.5 text-left hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
            >
                {inner}
            </button>
        );
    }

    return (
        <div className="w-full flex items-start justify-between gap-4 px-5 py-3.5">
            {inner}
        </div>
    );
};

interface SettingsBadgeProps {
    children: ReactNode;
    tone?: "neutral" | "accent";
}

/**
 * Small inline badge for SettingsRow ("Active", "Coming soon").
 */
export const SettingsBadge = ({ children, tone = "neutral" }: SettingsBadgeProps) => (
    <span
        className={cn(
            "text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded uppercase",
            tone === "accent"
                ? "bg-accent-tint text-accent-dk"
                : "bg-surface-2 text-muted",
        )}
    >
        {children}
    </span>
);
