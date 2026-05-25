import { forwardRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AvatarTriggerProps {
    size?: "sm" | "md";
    className?: string;
    onClick?: () => void;
}

const initialsOf = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "·";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/**
 * Round avatar button: profile photo when set, initials otherwise. Anchors the
 * UserMenu in the mobile top bar and elsewhere. Use inside a UserMenu's
 * trigger slot so it composes the dropdown automatically.
 */
export const AvatarTrigger = forwardRef<HTMLButtonElement, AvatarTriggerProps>(
    ({ size = "sm", className, onClick, ...props }, ref) => {
        const { user } = useAuth();
        const { members } = useHousehold();
        const me = members.find(m => m.user_id === user?.id);
        const fullName = me?.profiles?.full_name?.trim() || "";
        const avatarUrl = me?.profiles?.avatar_url || null;
        const initials = initialsOf(fullName);

        const dim = size === "sm" ? "h-8 w-8 text-[13px]" : "h-10 w-10 text-[15px]";

        return (
            <button
                ref={ref}
                type="button"
                onClick={onClick}
                aria-label="Account menu"
                className={cn(
                    "flex items-center justify-center rounded-full overflow-hidden shrink-0 hover:opacity-90 transition-opacity",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                    dim,
                    className,
                )}
                {...props}
            >
                <Avatar className="h-full w-full">
                    <AvatarImage src={avatarUrl || undefined} alt={fullName || "User"} />
                    <AvatarFallback className="bg-accent text-accent-ink font-bold">
                        {initials}
                    </AvatarFallback>
                </Avatar>
            </button>
        );
    },
);
AvatarTrigger.displayName = "AvatarTrigger";
