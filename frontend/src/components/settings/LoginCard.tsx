import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { toast } from "sonner";
import { SettingsCard, SettingsList, SettingsListItem } from "./SettingsCard";

export const LoginCard = () => {
    const { user } = useAuth();
    const { members } = useHousehold();
    const me = members.find(m => m.user_id === user?.id);
    const email = me?.profiles?.email || null;

    const handleChangePassword = async () => {
        if (!email) return;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth`,
        });
        if (error) {
            toast.error("Failed to send password reset email");
            return;
        }
        toast.success("Password reset email sent — check your inbox.");
    };

    return (
        <SettingsCard eyebrow="Login" contentClassName="p-0">
            <SettingsList>
                <SettingsListItem
                    title="Change password"
                    value={
                        <>
                            We'll email you a secure reset link.
                            <br />
                            Want stronger sign-in? Set up two-factor in Privacy &amp; Security.
                        </>
                    }
                    onClick={handleChangePassword}
                    disabled={!email}
                />
            </SettingsList>
        </SettingsCard>
    );
};
