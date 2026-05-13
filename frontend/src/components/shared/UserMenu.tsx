import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, LogOut } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";

interface UserMenuProps {
    /** The visible trigger element (avatar circle, user-card, etc.). */
    trigger: ReactNode;
    /** Where to anchor the menu. Default: bottom-end. */
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
}

/**
 * Account-level menu (Inställningar, Logga ut). Anchored to whatever
 * `trigger` element is passed — used by both the mobile AvatarTrigger and
 * the desktop sidebar user-card. Household-switching is omitted because
 * the app is single-household per user.
 */
export const UserMenu = ({ trigger, align = "end", side = "bottom" }: UserMenuProps) => {
    const navigate = useNavigate();
    const { signOut, user } = useAuth();
    const { members } = useHousehold();
    const me = members.find(m => m.user_id === user?.id);
    const fullName = me?.profiles?.full_name?.trim() || "";

    const handleLogout = async () => {
        await signOut();
        navigate("/auth");
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
            <DropdownMenuContent align={align} side={side} className="w-56">
                {fullName && (
                    <>
                        <div className="px-2 py-1.5 text-[13px] font-semibold text-ink truncate">{fullName}</div>
                        <DropdownMenuSeparator />
                    </>
                )}
                <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-2 cursor-pointer">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="gap-2 cursor-pointer">
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
