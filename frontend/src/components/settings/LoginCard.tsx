import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SettingsCard, SettingsList, SettingsListItem, SettingsBadge } from "./SettingsCard";

export const LoginCard = () => {
    const { user } = useAuth();
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        const fetchEmail = async () => {
            if (!user) return;
            const { data } = await supabase.from("profiles").select("email").eq("id", user.id).single();
            if (data) setEmail(data.email);
        };
        fetchEmail();
    }, [user]);

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
                    value="We'll email you a secure reset link."
                    onClick={handleChangePassword}
                    disabled={!email}
                />
                <SettingsListItem
                    title="Two-factor authentication"
                    value="Extra protection at sign-in via authenticator app."
                    badge={<SettingsBadge>Coming soon</SettingsBadge>}
                />
            </SettingsList>
        </SettingsCard>
    );
};
