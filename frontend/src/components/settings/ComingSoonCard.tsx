import { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ComingSoonCardProps {
    /** Section title (e.g. "Notifications"). */
    title: string;
    /** Short description. */
    description?: string;
    /** Optional leading icon. */
    icon?: ReactNode;
    /** Force a custom badge label. Default "Coming soon". */
    badge?: string;
}

/**
 * Placeholder for Settings sections whose backing feature isn't built yet.
 * Renders muted with a "Coming soon" badge, non-interactive.
 */
export const ComingSoonCard = ({
    title,
    description,
    icon,
    badge = "Coming soon",
}: ComingSoonCardProps) => (
    <Card className={cn("opacity-70 pointer-events-none select-none")}>
        <CardHeader>
            <div className="flex items-center gap-3">
                {icon && <div className="shrink-0 text-muted">{icon}</div>}
                <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-ink leading-none tracking-tight">{title}</h3>
                        <span className="text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-surface-2 text-muted uppercase">
                            {badge}
                        </span>
                    </div>
                    {description && (
                        <p className="text-sm text-muted">{description}</p>
                    )}
                </div>
            </div>
        </CardHeader>
    </Card>
);
