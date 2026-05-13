import { forwardRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { cn } from "@/lib/utils";

interface AvatarTriggerProps {
    size?: "sm" | "md";
    className?: string;
    onClick?: () => void;
}

/**
 * Round avatar button showing the user's first initial. Anchors the
 * UserMenu in the mobile top bar and elsewhere. Use inside a UserMenu's
 * trigger slot so it composes the dropdown automatically.
 */
export const AvatarTrigger = forwardRef<HTMLButtonElement, AvatarTriggerProps>(
    ({ size = "sm", className, onClick, ...props }, ref) => {
        const { user } = useAuth();
        const { members } = useHousehold();
        const me = members.find(m => m.user_id === user?.id);
        const fullName = me?.profiles?.full_name?.trim() || "";
        const initial = fullName ? fullName.charAt(0).toUpperCase() : "·";

        const dim = size === "sm" ? "h-8 w-8 text-[13px]" : "h-10 w-10 text-[15px]";

        return (
            <button
                ref={ref}
                type="button"
                onClick={onClick}
                aria-label="Account menu"
                className={cn(
                    "rounded-full bg-accent text-accent-ink flex items-center justify-center font-bold shrink-0",
                    "hover:bg-accent/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                    dim,
                    className,
                )}
                {...props}
            >
                {initial}
            </button>
        );
    },
);
AvatarTrigger.displayName = "AvatarTrigger";
