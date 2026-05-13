import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { toast } from "sonner";
import { SettingsCard, SettingsList, SettingsListItem } from "./SettingsCard";
import { EditNameDialog } from "./dialogs/EditNameDialog";
import { EditBirthdateDialog } from "./dialogs/EditBirthdateDialog";

/**
 * Personal info rows. Reads from HouseholdContext.members (already populated)
 * and writes through to the profiles table. Triggers a context refresh after
 * any save so the rest of the app sees the new value.
 */
export const PersonalInfoCard = () => {
    const { user } = useAuth();
    const { members, refresh: refreshHousehold } = useHousehold();
    const [editingName, setEditingName] = useState(false);
    const [editingBirthdate, setEditingBirthdate] = useState(false);

    const me = members.find(m => m.user_id === user?.id);
    const fullName = me?.profiles?.full_name || "";
    const email = me?.profiles?.email || "";
    const emailPublic = me?.profiles?.email_public ?? true;
    const birthdate = me?.profiles?.birthdate ? new Date(me.profiles.birthdate) : undefined;

    const updateProfile = async (patch: Record<string, any>, successMsg: string) => {
        if (!user) return;
        const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
        if (error) {
            toast.error("Failed to update profile");
            return;
        }
        toast.success(successMsg);
        await refreshHousehold();
    };

    const handleNameSave = (newName: string) => updateProfile({ full_name: newName }, "Name updated");
    const handleBirthdateSave = (newBirthdate: Date | undefined) =>
        updateProfile(
            { birthdate: newBirthdate ? format(newBirthdate, "yyyy-MM-dd") : null },
            "Date of birth updated",
        );

    const handleEmailVisibilityChange = async (next: boolean) => {
        if (!user) return;
        const { error } = await supabase
            .from("profiles")
            .update({ email_public: next })
            .eq("id", user.id);
        if (error) {
            toast.error("Failed to update visibility");
            return;
        }
        await refreshHousehold();
    };

    return (
        <>
            <SettingsCard eyebrow="Personal info" contentClassName="p-0">
                <SettingsList>
                    <SettingsListItem
                        title="Name"
                        value={fullName || "Not set"}
                        onClick={() => setEditingName(true)}
                    />
                    <SettingsListItem title="Email" value={email} />
                    <SettingsListItem
                        title="Email visible to household"
                        value={emailPublic ? "Other members can see your email." : "Hidden from other members."}
                        control={<Switch checked={emailPublic} onCheckedChange={handleEmailVisibilityChange} />}
                    />
                    <SettingsListItem
                        title="Date of birth"
                        value={birthdate ? format(birthdate, "yyyy-MM-dd") : "Not set"}
                        onClick={() => setEditingBirthdate(true)}
                    />
                </SettingsList>
            </SettingsCard>
            <EditNameDialog
                open={editingName}
                onOpenChange={setEditingName}
                currentName={fullName}
                onSave={handleNameSave}
            />
            <EditBirthdateDialog
                open={editingBirthdate}
                onOpenChange={setEditingBirthdate}
                currentBirthdate={birthdate}
                onSave={handleBirthdateSave}
            />
        </>
    );
};
