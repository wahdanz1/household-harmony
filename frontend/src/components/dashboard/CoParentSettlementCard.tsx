import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { HandCoins, Check, History } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";

interface CoParentSettlementCardProps {
  householdId: string;
  currency: string;
}

export const CoParentSettlementCard = ({ householdId, currency }: CoParentSettlementCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [coParents, setCoParents] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<Record<string, any>>({});
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [selectedCoParent, setSelectedCoParent] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const currentMonth = getCurrentFinancialMonth();
  const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth);
  const currentMonthNumber = new Date().getMonth() + 1; // Keep this for insurance invoice_month for now

  const fetchData = async () => {
    const { data: coParentsData } = await supabase
      .from("co_parents")
      .select("*")
      .eq("household_id", householdId);

    setCoParents(coParentsData || []);

    // Calculate settlement for each co-parent
    const settlementData: Record<string, any> = {};

    for (const coParent of coParentsData || []) {
      // Fetch shared income for this month (using overlap logic)
      const { data: sharedIncomes } = await supabase
        .from("monthly_incomes")
        .select("amount, share_percentage")
        .eq("household_id", householdId)
        .gte("month_end", format(monthStart, "yyyy-MM-dd"))
        .lte("month_start", format(monthEnd, "yyyy-MM-dd"))
        .eq("is_shared", true)
        .eq("co_parent_id", coParent.id);

      const incomeReceived = (sharedIncomes || []).reduce((sum, inc) => sum + parseFloat(inc.amount.toString()), 0);
      const yourShareOfIncome = (sharedIncomes || []).reduce((sum, inc) => {
        const sharePercentage = parseFloat(inc.share_percentage.toString());
        return sum + (parseFloat(inc.amount.toString()) * sharePercentage / 100);
      }, 0);

      // Fetch shared insurances that have invoice_month matching current month
      // Insurance is typically monthly based on calendar month, so keeping invoice_month logic for now
      // unless user specifies otherwise.
      const { data: sharedInsurances } = await supabase
        .from("insurances")
        .select("total_amount, share_percentage, invoice_month")
        .eq("household_id", householdId)
        .eq("is_shared", true)
        .eq("co_parent_id", coParent.id)
        .eq("is_active", true)
        .eq("invoice_month", currentMonthNumber);

      let insurancePaid = 0;
      let theirShareOfInsurance = 0;

      (sharedInsurances || []).forEach((ins) => {
        insurancePaid += parseFloat(ins.total_amount.toString());
        theirShareOfInsurance += parseFloat(ins.total_amount.toString()) * parseFloat(ins.share_percentage.toString()) / 100;
      });

      // Fetch shared expenses - separate by who paid (using overlap logic)
      const { data: sharedExpenses } = await supabase
        .from("shared_expenses")
        .select("amount, paid_by")
        .eq("household_id", householdId)
        .eq("co_parent_id", coParent.id)
        .gte("month_end", format(monthStart, "yyyy-MM-dd"))
        .lte("month_start", format(monthEnd, "yyyy-MM-dd"));

      // Calculate: expenses they paid = add to what you send, expenses you paid = subtract from what you send
      let expensesYouPaid = 0;
      let expensesTheyPaid = 0;

      (sharedExpenses || []).forEach((exp) => {
        const amount = parseFloat(exp.amount.toString());
        if (exp.paid_by === "user") {
          expensesYouPaid += amount;
        } else {
          expensesTheyPaid += amount;
        }
      });

      // New calculation logic:
      // 1. Start with 50% of shared income (amount owed to them)
      const amountOwedFromIncome = incomeReceived - yourShareOfIncome;

      // 2. Add their share of insurance you paid
      // 3. Add 50% of expenses they paid
      // 4. Subtract 50% of expenses you paid
      const netAmount = amountOwedFromIncome + theirShareOfInsurance + (expensesTheyPaid / 2) - (expensesYouPaid / 2);

      settlementData[coParent.id] = {
        incomeReceived,
        yourShareOfIncome,
        insurancePaid,
        theirShareOfInsurance,
        expensesYouPaid,
        expensesTheyPaid,
        netAmount,
      };
    }

    setSettlements(settlementData);
  };

  useEffect(() => {
    fetchData();
  }, [householdId]);

  const handleMarkAsSettled = async () => {
    if (!selectedCoParent || !user) return;

    const settlement = settlements[selectedCoParent];
    const data = {
      household_id: householdId,
      co_parent_id: selectedCoParent,
      month: currentMonth,
      income_received: settlement.incomeReceived,
      your_share_of_income: settlement.yourShareOfIncome,
      insurance_paid: settlement.insurancePaid,
      their_share_of_insurance: settlement.theirShareOfInsurance,
      shared_expenses_total: settlement.expensesYouPaid + settlement.expensesTheyPaid,
      net_amount: settlement.netAmount,
      notes,
      settled_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("co_parent_settlements")
      .upsert(data, { onConflict: "household_id,co_parent_id,month" });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to mark as settled",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Settlement marked as complete",
      });
      setSettleDialogOpen(false);
      setSelectedCoParent(null);
      setNotes("");
    }
  };

  if (coParents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {coParents.map((coParent) => {
        const settlement = settlements[coParent.id];
        if (!settlement) return null;

        return (
          <Card key={coParent.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HandCoins className="h-5 w-5" />
                Settlement with {coParent.name}
              </CardTitle>
              <CardDescription>{format(new Date(currentMonth), "MMMM yyyy")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shared Income Received:</span>
                  <span className="text-success">+{settlement.incomeReceived.toFixed(0)} {currency}</span>
                </div>
                <div className="flex justify-between pl-4">
                  <span className="text-muted-foreground">Your {settlement.yourShareOfIncome > 0 ? (settlement.yourShareOfIncome / settlement.incomeReceived * 100).toFixed(0) : 0}% to keep:</span>
                  <span className="text-muted-foreground">-{settlement.yourShareOfIncome.toFixed(0)} {currency}</span>
                </div>
                <div className="border-t border-border/50 pt-2">
                  <div className="flex justify-between font-medium">
                    <span>Amount owed from income:</span>
                    <span className="text-warning">+{(settlement.incomeReceived - settlement.yourShareOfIncome).toFixed(0)} {currency}</span>
                  </div>
                </div>

                {settlement.insurancePaid > 0 && (
                  <>
                    <div className="flex justify-between pt-2">
                      <span className="text-muted-foreground">Insurance paid this month:</span>
                      <span>-{settlement.insurancePaid.toFixed(0)} {currency}</span>
                    </div>
                    <div className="flex justify-between pl-4">
                      <span className="text-muted-foreground">Their {settlement.theirShareOfInsurance > 0 ? ((settlement.theirShareOfInsurance / settlement.insurancePaid) * 100).toFixed(0) : 0}% credit:</span>
                      <span className="text-success">+{settlement.theirShareOfInsurance.toFixed(0)} {currency}</span>
                    </div>
                  </>
                )}

                {settlement.expensesTheyPaid > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expenses they paid (your 50%):</span>
                    <span className="text-success">+{(settlement.expensesTheyPaid / 2).toFixed(0)} {currency}</span>
                  </div>
                )}

                {settlement.expensesYouPaid > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expenses you paid (their 50%):</span>
                    <span className="text-destructive">-{(settlement.expensesYouPaid / 2).toFixed(0)} {currency}</span>
                  </div>
                )}

                <div className="border-t-2 border-border pt-2 mt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>{settlement.netAmount >= 0 ? "Amount to send:" : "Amount to receive:"}</span>
                    <span className={settlement.netAmount >= 0 ? "text-warning" : "text-success"}>
                      {settlement.netAmount >= 0 ? settlement.netAmount.toFixed(0) : Math.abs(settlement.netAmount).toFixed(0)} {currency}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Dialog open={settleDialogOpen && selectedCoParent === coParent.id} onOpenChange={(open) => {
                  setSettleDialogOpen(open);
                  if (!open) {
                    setSelectedCoParent(null);
                    setNotes("");
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button
                      className="flex-1"
                      onClick={() => setSelectedCoParent(coParent.id)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Mark as Settled
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Mark Settlement as Complete</DialogTitle>
                      <DialogDescription>
                        Confirm that you've sent {settlement.netAmount.toFixed(0)} {currency} to {coParent.name}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Notes (Optional)</Label>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Transaction reference, payment method, etc."
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleMarkAsSettled}>Confirm Settlement</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" size="icon">
                  <History className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};