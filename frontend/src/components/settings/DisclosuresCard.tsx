import { FileUp, ShieldCheck } from "lucide-react";
import { SettingsCard, SettingsList, SettingsListItem } from "./SettingsCard";

export const DisclosuresCard = () => (
    <SettingsCard eyebrow="Disclosures" contentClassName="p-0">
        <SettingsList>
            <SettingsListItem
                icon={<FileUp className="h-5 w-5" />}
                title="Statement parsing"
                value={
                    <>
                        Credit-card statement PDFs are sent to a third-party AI service
                        (Groq or Gemini) for parsing. Only per-category totals come back
                        and are encrypted with your vault. Raw PDFs and individual
                        transactions are not retained by Household Harmony. Turn off
                        Credit cards in Household → Extra features to opt out.
                    </>
                }
            />
            <SettingsListItem
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Everything else stays on-device"
                value="Incomes, expenses, subscriptions, insurances, and shared notes are end-to-end encrypted with your vault key. The server stores ciphertext only."
            />
        </SettingsList>
    </SettingsCard>
);
