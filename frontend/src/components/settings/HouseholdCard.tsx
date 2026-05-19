import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SettingsCard, SettingsList, SettingsListItem } from "./SettingsCard";
import { EditHouseholdNameDialog } from "./dialogs/EditHouseholdNameDialog";
import { EditFinancialMonthDialog } from "./dialogs/EditFinancialMonthDialog";
import { JoinExistingUserDialog } from "./JoinExistingUserDialog";
import { isDemoMode } from "@/utils/demoMode";

interface HouseholdCardProps {
    household: {
        id: string;
        name: string;
        owner_id: string;
        financial_month_start?: number;
    };
    members: any[];
    userRole: string;
    onUpdate: () => void;
}

export const HouseholdCard = ({ household, members, userRole, onUpdate }: HouseholdCardProps) => {
    const { user } = useAuth();
    const { refresh: refreshHousehold } = useHousehold();
    const [editingName, setEditingName] = useState(false);
    const [editingFm, setEditingFm] = useState(false);
    const [joinOpen, setJoinOpen] = useState(false);
    const [leaveOpen, setLeaveOpen] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    const isOwner = userRole === "owner";
    const hasOtherMembers = members.length > 1;
    const shouldShowJoin = !isOwner || !hasOtherMembers;
    const demoMode = isDemoMode();

    const fmStart = household.financial_month_start || 25;
    const fmEnd = fmStart === 1 ? 31 : fmStart - 1;

    const updateHousehold = async (patch: Record<string, any>, successMsg: string) => {
        const { error } = await supabase.from("households").update(patch).eq("id", household.id);
        if (error) {
            toast.error("Failed to update household");
            return;
        }
        toast.success(successMsg);
        await refreshHousehold();
        onUpdate();
    };

    const handleLeave = async () => {
        if (!user) return;
        setIsLeaving(true);

        const { data: membership } = await supabase
            .from("household_members")
            .select("id")
            .eq("user_id", user.id)
            .eq("household_id", household.id)
            .maybeSingle();

        if (!membership) {
            toast.error("Membership not found");
            setIsLeaving(false);
            return;
        }

        const { error } = await (supabase as any).rpc("request_member_exit", {
            member_id_in: membership.id,
        });

        if (error) {
            toast.error(
                error.message === "owner_must_transfer_first"
                    ? "You're the owner. Transfer ownership before leaving."
                    : "Failed to leave household",
            );
            setIsLeaving(false);
            return;
        }

        toast.success("Leaving household — reloading…");
        setLeaveOpen(false);
        setTimeout(() => window.location.reload(), 1000);
    };

    return (
        <>
            <SettingsCard eyebrow="Household" contentClassName="p-0">
                <SettingsList>
                    <SettingsListItem
                        title="Name"
                        value={household.name}
                        onClick={isOwner ? () => setEditingName(true) : undefined}
                    />
                    <SettingsListItem
                        title="Financial month"
                        value={`Starts on the ${fmStart}${ordinal(fmStart)} · ${fmStart} → ${fmEnd}`}
                        onClick={isOwner ? () => setEditingFm(true) : undefined}
                    />
                    {shouldShowJoin && (
                        <SettingsListItem
                            title="Join another household"
                            value="Use an invite code from another household."
                            onClick={demoMode ? undefined : () => setJoinOpen(true)}
                            disabled={demoMode}
                        />
                    )}
                    {!isOwner && (
                        <SettingsListItem
                            title="Leave household"
                            value="You'll be set up in a fresh household. Items you attributed to yourself can come along; everything else stays."
                            onClick={() => setLeaveOpen(true)}
                        />
                    )}
                </SettingsList>
            </SettingsCard>

            <EditHouseholdNameDialog
                open={editingName}
                onOpenChange={setEditingName}
                currentName={household.name}
                onSave={(name) => updateHousehold({ name }, "Household name updated")}
            />
            <EditFinancialMonthDialog
                open={editingFm}
                onOpenChange={setEditingFm}
                currentDay={fmStart}
                onSave={(financial_month_start) =>
                    updateHousehold({ financial_month_start }, "Financial month updated")
                }
            />
            <JoinExistingUserDialog open={joinOpen} onOpenChange={setJoinOpen} onSuccess={onUpdate} />

            <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Leave {household.name}?</DialogTitle>
                        <DialogDescription>
                            You'll be set up in a fresh household. On the next screen you can pick which of your personal items to bring along — anything you didn't attribute to yourself stays in {household.name}.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setLeaveOpen(false)} disabled={isLeaving}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleLeave} disabled={isLeaving}>
                            {isLeaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Leaving…</> : "Leave household"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
};
