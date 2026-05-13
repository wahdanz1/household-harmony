import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ResetDataCardProps {
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

export const ResetDataCard = ({ householdId, householdName, isOwner, onComplete }: ResetDataCardProps) => {
    const [open, setOpen] = useState(false);
    const [confirmation, setConfirmation] = useState("");
    const [resetting, setResetting] = useState(false);

    if (!isOwner) return null;

    const expectedConfirmation = householdName.trim();
    const canConfirm = confirmation.trim() === expectedConfirmation && expectedConfirmation.length > 0;

    const handleReset = async () => {
        if (!canConfirm) return;
        setResetting(true);
        const failures: string[] = [];
        for (const table of WIPED_TABLES) {
            const { error } = await (supabase as any)
                .from(table)
                .delete()
                .eq("household_id", householdId);
            // Keep going if one table errors — partial wipes are worse than a
            // best-effort full sweep with a clear failure report at the end.
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
        setTimeout(() => {
            window.location.reload();
        }, 600);
    };

    return (
        <Card className="border-danger/40">
            <CardHeader>
                <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                        <CardTitle>Reset financial data</CardTitle>
                        <CardDescription>
                            Deletes every income, expense, subscription, insurance, savings goal,
                            credit card and per-month record in this household. The household itself
                            and its members stay. Cannot be undone.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Button variant="destructive" onClick={() => setOpen(true)}>
                    Reset all financial data
                </Button>
            </CardContent>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmation(""); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset {householdName}?</DialogTitle>
                        <DialogDescription>
                            Type the household name <span className="font-mono font-semibold">{expectedConfirmation}</span> to confirm.
                            This wipes every financial record but keeps members and the household itself.
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
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={resetting}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReset}
                            disabled={!canConfirm || resetting}
                        >
                            {resetting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Resetting…</> : "Reset everything"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};
