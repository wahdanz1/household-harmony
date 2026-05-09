import { Card } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { VaultUnlockButton } from "@/components/shared/VaultUnlockDialog";

interface VaultLockedAlertProps {
    description?: string;
    className?: string;
}

/**
 * Reassuring "your data is encrypted" notice. Shown when the user hasn't
 * unlocked their vault for the session. This is informational, not alarming
 * — the encryption is a feature, not a problem. Soft-accent surface, shield
 * icon, primary "Unlock" CTA. On mobile this becomes the page's primary
 * message (vertically centered, larger typography).
 */
export const VaultLockedAlert = ({
    description = "Unlock your vault to view and manage your finances.",
    className,
}: VaultLockedAlertProps) => {
    return (
        <div className={cn("flex flex-col justify-center min-h-[55vh] sm:min-h-0", className)}>
            <Card className="bg-accent-tint border-accent/20 flex items-start gap-4 flex-wrap">
                {/* Icon badge */}
                <div className="w-11 h-11 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-5 w-5 text-accent-dk" />
                </div>

                {/* Title + description */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-xl sm:text-base font-semibold text-accent-dk leading-tight">
                        Your data is encrypted
                    </h3>
                    <p className="text-base sm:text-sm text-accent-dk/80 mt-1.5">
                        {description}
                    </p>
                </div>

                {/* Action */}
                <VaultUnlockButton
                    variant="primary"
                    className="w-full sm:w-auto sm:shrink-0"
                />
            </Card>
        </div>
    );
};
