import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2, Trash2, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SettingsCard, SettingsList, SettingsListItem, SettingsBadge } from "./SettingsCard";

interface DangerZoneCardProps {
    householdId: string;
    householdName: string;
    isOwner: boolean;
    onComplete: () => void;
}

const WIPED_TABLES = [
    "monthly_expenses",
    "monthly_incomes",
    "monthly_review_status",
    "merchant_categories",
    "shared_expenses",
    "co_parent_settlements",
    "temporary_expenses",
    "expenses",
    "income_sources",
    "subscriptions",
    "insurances",
    "credit_cards",
    "co_parents",
] as const;

export const DangerZoneCard = ({ householdId, householdName, isOwner, onComplete }: DangerZoneCardProps) => {
    const [resetOpen, setResetOpen] = useState(false);
    const [confirmation, setConfirmation] = useState("");
    const [resetting, setResetting] = useState(false);

    const expectedConfirmation = householdName.trim();
    const canConfirm = confirmation.trim() === expectedConfirmation && expectedConfirmation.length > 0;

    const handleReset = async () => {
        if (!canConfirm) return;
        setResetting(true);
        const failures: string[] = [];
        for (const table of WIPED_TABLES) {
            const { error } = await (supabase as any).from(table).delete().eq("household_id", householdId);
            if (error) {
                console.error(`Failed to wipe ${table}:`, error);
                failures.push(table);
            }
        }
        if (failures.length > 0) {
            toast.error(`Reset finished with errors on: ${failures.join(", ")}`);
            setResetting(false);
            return;
        }
        localStorage.removeItem(`hh_setup_done_${householdId}`);
        toast.success("Financial data reset. Refreshing…");
        setTimeout(() => window.location.reload(), 600);
        onComplete();
    };

    return (
        <>
            <SettingsCard eyebrow="Danger zone" tone="danger" contentClassName="p-0">
                <SettingsList>
                    {isOwner && (
                        <SettingsListItem
                            icon={<AlertTriangle className="h-5 w-5 text-danger" />}
                            title="Reset all financial data"
                            value="Wipes every income, expense, subscription, insurance, credit card, and per-month record in this household. Members and household settings stay. Cannot be undone."
                            onClick={() => setResetOpen(true)}
                        />
                    )}
                    <SettingsListItem
                        icon={<UserX className="h-5 w-5 text-muted" />}
                        title="Delete account"
                        value="Removes your user account, memberships, and vault. Owned households need to be reassigned or deleted first."
                        badge={<SettingsBadge>Coming soon</SettingsBadge>}
                    />
                </SettingsList>
            </SettingsCard>

            <Dialog open={resetOpen} onOpenChange={(v) => { setResetOpen(v); if (!v) setConfirmation(""); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset {householdName}?</DialogTitle>
                        <DialogDescription>
                            Type the household name <span className="font-mono font-semibold">{expectedConfirmation}</span> to confirm. This wipes every financial record but keeps members and the household itself.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label htmlFor="reset-confirm">Household name</Label>
                        <Input
                            id="reset-confirm"
                            value={confirmation}
                            onChange={(e) => setConfirmation(e.target.value)}
                            placeholder={expectedConfirmation}
                            autoComplete="off"
                            disabled={resetting}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResetOpen(false)} disabled={resetting}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReset} disabled={!canConfirm || resetting}>
                            {resetting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Resetting…</> : <><Trash2 className="h-4 w-4 mr-2" />Reset everything</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
