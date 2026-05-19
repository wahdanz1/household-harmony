import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getCurrentFinancialMonth } from "@/utils/dateUtils";
import type { CoParentSettlement } from "@/hooks/useCoParentSettlements";

interface CoParentSettlementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    householdId: string;
    coParent: { id: string; name: string };
    settlement: CoParentSettlement;
    currency: string;
    onSettled?: () => void;
}

export const CoParentSettlementDialog = ({
    open, onOpenChange, householdId, coParent, settlement, currency, onSettled,
}: CoParentSettlementDialogProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) setNotes("");
    }, [open]);

    const isOwing = settlement.netAmount >= 0;
    const abs = Math.abs(settlement.netAmount);
    const currentMonth = getCurrentFinancialMonth();
    const currentMonthLabel = format(new Date(currentMonth), "MMMM yyyy");

    const handleMarkAsSettled = async () => {
        if (!user) return;
        setSaving(true);
        const { error } = await supabase
            .from("co_parent_settlements")
            .upsert({
                household_id: householdId,
                co_parent_id: coParent.id,
                month: currentMonth,
                income_received: settlement.incomeReceived,
                your_share_of_income: settlement.yourShareOfIncome,
                insurance_paid: settlement.insurancePaid,
                their_share_of_insurance: settlement.theirShareOfInsurance,
                shared_expenses_total: settlement.expensesYouPaid + settlement.expensesTheyPaid,
                net_amount: settlement.netAmount,
                notes,
                settled_at: new Date().toISOString(),
            }, { onConflict: "household_id,co_parent_id,month" });
        setSaving(false);

        if (error) {
            toast({ title: "Error", description: "Failed to mark as settled", variant: "destructive" });
            return;
        }
        toast({ title: "Settled", description: `${coParent.name} marked as settled for ${currentMonthLabel}.` });
        onSettled?.();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Settlement with {coParent.name}</DialogTitle>
                    <DialogDescription>{currentMonthLabel}</DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <div className="rounded-lg bg-surface-2/40 border border-line p-4 text-center">
                        <Money
                            v={abs}
                            currency={currency}
                            size="xl"
                            weight={700}
                            className={isOwing ? "text-warn" : "text-accent"}
                        />
                        <p className="text-xs text-muted mt-1">
                            {abs === 0 ? "Settled" : isOwing ? `You owe ${coParent.name}` : `${coParent.name} owes you`}
                        </p>
                    </div>

                    <div className="space-y-2 text-sm">
                        {settlement.incomeReceived > 0 && (
                            <>
                                <div className="flex justify-between">
                                    <span className="text-muted">Shared income received</span>
                                    <Money v={settlement.incomeReceived} currency={currency} size="sm" weight={500} color="accent" />
                                </div>
                                <div className="flex justify-between text-xs pl-4">
                                    <span className="text-muted">
                                        Your {settlement.yourShareOfIncome > 0 ? (settlement.yourShareOfIncome / settlement.incomeReceived * 100).toFixed(0) : 0}% to keep
                                    </span>
                                    <Money v={-settlement.yourShareOfIncome} currency={currency} size="xs" weight={500} color="muted" />
                                </div>
                            </>
                        )}

                        {settlement.insurancePaid > 0 && (
                            <>
                                <div className="flex justify-between pt-2">
                                    <span className="text-muted">Insurance paid</span>
                                    <Money v={-settlement.insurancePaid} currency={currency} size="sm" weight={500} />
                                </div>
                                <div className="flex justify-between text-xs pl-4">
                                    <span className="text-muted">
                                        Their {((settlement.theirShareOfInsurance / settlement.insurancePaid) * 100).toFixed(0)}% credit
                                    </span>
                                    <Money v={settlement.theirShareOfInsurance} currency={currency} size="xs" weight={500} color="accent" />
                                </div>
                            </>
                        )}

                        {settlement.expensesTheyPaid > 0 && (
                            <div className="flex justify-between pt-2">
                                <span className="text-muted">Expenses they paid (your 50%)</span>
                                <Money v={settlement.expensesTheyPaid / 2} currency={currency} size="sm" weight={500} color="accent" />
                            </div>
                        )}

                        {settlement.expensesYouPaid > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted">Expenses you paid (their 50%)</span>
                                <Money v={-settlement.expensesYouPaid / 2} currency={currency} size="sm" weight={500} color="danger" />
                            </div>
                        )}
                    </div>

                    {abs > 0 && (
                        <div className="space-y-1.5 pt-2">
                            <Label htmlFor="settle-notes">Notes (optional)</Label>
                            <Textarea
                                id="settle-notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Transaction reference, payment method, etc."
                            />
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-between">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Close
                    </Button>
                    <Button onClick={handleMarkAsSettled} disabled={saving}>
                        <Check className="h-4 w-4 mr-2" />
                        {saving ? "Saving…" : "Mark as settled"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
