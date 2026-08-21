import { Switch } from "@/components/ui/switch";
import { CreditCard, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SettingsCard, SettingsList, SettingsListItem } from "./SettingsCard";

interface ExtraFeaturesCardProps {
    householdId: string;
    enableCreditCards: boolean;
    enableSharedExpenses: boolean;
    onUpdate: () => void;
}

export const ExtraFeaturesCard = ({ householdId, enableCreditCards, enableSharedExpenses, onUpdate }: ExtraFeaturesCardProps) => {
    const { toast } = useToast();

    const toggle = async (column: "enable_credit_cards" | "enable_shared_expenses", enabled: boolean, label: string) => {
        const { error } = await supabase.from("households").update({ [column]: enabled }).eq("id", householdId);
        if (error) {
            toast({ title: "Error", description: `Failed to update ${label}`, variant: "destructive" });
        } else {
            onUpdate();
        }
    };

    return (
        <SettingsCard eyebrow="Extra features" contentClassName="p-0">
            <SettingsList>
                <SettingsListItem
                    icon={<CreditCard className="h-5 w-5" />}
                    title="Credit cards"
                    value={
                        enableCreditCards
                            ? <>Mark expenses as credit-paid and import statements during Monthly Review. Statements are parsed off-device by a third-party AI service — only per-category totals are stored, encrypted.</>
                            : "Mark expenses as credit-paid and import statements during Monthly Review."
                    }
                    control={
                        <Switch
                            checked={enableCreditCards}
                            onCheckedChange={(v) => toggle("enable_credit_cards", v, "credit cards")}
                        />
                    }
                />
                <SettingsListItem
                    icon={<Users className="h-5 w-5" />}
                    title="Shared expenses"
                    value={
                        enableSharedExpenses
                            ? <>Track expenses shared with co-parents. Manage them under <strong className="font-semibold text-ink">Members</strong>.</>
                            : "Track expenses shared with co-parents."
                    }
                    control={
                        <Switch
                            checked={enableSharedExpenses}
                            onCheckedChange={(v) => toggle("enable_shared_expenses", v, "shared expenses")}
                        />
                    }
                />
            </SettingsList>
        </SettingsCard>
    );
};
