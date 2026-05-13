import { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SettingsCardProps {
    /** Uppercase eyebrow label (e.g. "THEME", "LANGUAGE"). */
    eyebrow: string;
    children: ReactNode;
    /** Soft-disabled appearance for not-yet-shipped sections. */
    dim?: boolean;
    className?: string;
}

/**
 * Standard Settings tab card. Eyebrow at top, structured content below.
 * Matches the bundle's Allmänt/General layout — see
 * design-system/.../preview Allmänt screenshot and
 * docs/design/drift-audit.md § 4.6.
 */
export const SettingsCard = ({ eyebrow, children, dim, className }: SettingsCardProps) => (
    <Card
        className={cn(
            dim && "opacity-70 pointer-events-none select-none",
            className,
        )}
    >
        <CardHeader className="pb-3">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.08em]">
                {eyebrow}
            </p>
        </CardHeader>
        <CardContent className="pt-0">{children}</CardContent>
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
