import { ShieldCheck } from "lucide-react";
import { SettingsCard, SettingsList, SettingsListItem, SettingsBadge } from "./SettingsCard";

export const TwoFactorCard = () => (
    <SettingsCard eyebrow="Two-factor authentication" contentClassName="p-0" dim>
        <SettingsList>
            <SettingsListItem
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Authenticator app"
                value="Require a 6-digit code from your authenticator app on every sign-in."
                badge={<SettingsBadge>Coming soon</SettingsBadge>}
            />
        </SettingsList>
    </SettingsCard>
);
