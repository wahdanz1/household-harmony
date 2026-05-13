import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { toast } from "sonner";
import { SettingsCard, SettingsList, SettingsListItem } from "./SettingsCard";
import { EditNameDialog } from "./dialogs/EditNameDialog";
import { EditBirthdateDialog } from "./dialogs/EditBirthdateDialog";

interface PersonalInfoCardProps {
    /** Fired after a successful save so a parent can refresh sibling cards (e.g., ProfileCard). */
    onProfileUpdate?: () => void;
}

export const PersonalInfoCard = ({ onProfileUpdate }: PersonalInfoCardProps = {}) => {
    const { user } = useAuth();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [birthdate, setBirthdate] = useState<Date | undefined>(undefined);
    const [emailPublic, setEmailPublic] = useState(true);
    const [editingName, setEditingName] = useState(false);
    const [editingBirthdate, setEditingBirthdate] = useState(false);

    const fetchProfile = async () => {
        if (!user) return;
        const { data } = await supabase
            .from("profiles")
            .select("full_name, email, birthdate, email_public")
            .eq("id", user.id)
            .single();
        if (data) {
            setFullName(data.full_name || "");
            setEmail(data.email);
            setEmailPublic(data.email_public ?? true);
            setBirthdate(data.birthdate ? new Date(data.birthdate) : undefined);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [user]);

    const handleNameSave = async (newName: string) => {
        if (!user) return;
        const { error } = await supabase.from("profiles").update({ full_name: newName }).eq("id", user.id);
        if (error) {
            toast.error("Failed to update name");
            return;
        }
        setFullName(newName);
        toast.success("Name updated");
        onProfileUpdate?.();
    };

    const handleBirthdateSave = async (newBirthdate: Date | undefined) => {
        if (!user) return;
        const { error } = await supabase
            .from("profiles")
            .update({ birthdate: newBirthdate ? format(newBirthdate, "yyyy-MM-dd") : null })
            .eq("id", user.id);
        if (error) {
            toast.error("Failed to update date of birth");
            return;
        }
        setBirthdate(newBirthdate);
        toast.success("Date of birth updated");
    };

    const handleEmailVisibilityChange = async (next: boolean) => {
        if (!user) return;
        const prev = emailPublic;
        setEmailPublic(next);
        const { error } = await supabase
            .from("profiles")
            .update({ email_public: next })
            .eq("id", user.id);
        if (error) {
            setEmailPublic(prev);
            toast.error("Failed to update visibility");
        }
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
