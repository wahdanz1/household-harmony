import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { HandCoins, Check, History, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
import { useEncryptedFields, monthlyIncomeFields, insuranceFields, sharedExpenseFields } from "@/hooks/useEncryptedFields";

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
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const currentMonth = getCurrentFinancialMonth();
  const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth);
  const currentMonthNumber = new Date().getMonth() + 1;

  const { decryptRecords: decryptIncomes } = useEncryptedFields(monthlyIncomeFields);
  const { decryptRecords: decryptInsurances } = useEncryptedFields(insuranceFields);
  const { decryptRecords: decryptShared } = useEncryptedFields(sharedExpenseFields);

  const fetchData = async () => {
    const { data: coParentsData } = await supabase
      .from("co_parents")
      .select("*")
      .eq("household_id", householdId);

    setCoParents(coParentsData || []);

    const settlementData: Record<string, any> = {};

    for (const coParent of coParentsData || []) {
      const { data: sharedIncomesRaw } = await supabase
        .from("monthly_incomes")
        .select("encrypted_amount, share_percentage, is_encrypted")
        .eq("household_id", householdId)
        .gte("month_end", format(monthStart, "yyyy-MM-dd"))
        .lte("month_start", format(monthEnd, "yyyy-MM-dd"))
        .eq("is_shared", true)
        .eq("co_parent_id", coParent.id);

      const sharedIncomes = (await decryptIncomes(sharedIncomesRaw || [])) as any[];

      const incomeReceived = (sharedIncomes || []).reduce((sum, inc) => sum + parseFloat((inc.amount || 0).toString()), 0);
      const yourShareOfIncome = (sharedIncomes || []).reduce((sum, inc) => {
        const sharePercentage = parseFloat((inc.share_percentage || 0).toString());
        return sum + (parseFloat((inc.amount || 0).toString()) * sharePercentage / 100);
      }, 0);

      const { data: sharedInsurancesRaw } = await supabase
        .from("insurances")
        .select("encrypted_total_amount, share_percentage, invoice_month, is_encrypted")
        .eq("household_id", householdId)
        .eq("is_shared", true)
        .eq("co_parent_id", coParent.id)
        .eq("is_active", true)
        .eq("invoice_month", currentMonthNumber);

      const sharedInsurances = (await decryptInsurances(sharedInsurancesRaw || [])) as any[];

      let insurancePaid = 0;
      let theirShareOfInsurance = 0;

      (sharedInsurances || []).forEach((ins) => {
        insurancePaid += parseFloat((ins.total_amount || 0).toString());
        theirShareOfInsurance += parseFloat((ins.total_amount || 0).toString()) * parseFloat((ins.share_percentage || 0).toString()) / 100;
      });

      const { data: sharedExpensesRaw } = await supabase
        .from("shared_expenses")
        .select("encrypted_amount, paid_by, is_encrypted")
        .eq("household_id", householdId)
        .eq("co_parent_id", coParent.id)
        .gte("month_end", format(monthStart, "yyyy-MM-dd"))
        .lte("month_start", format(monthEnd, "yyyy-MM-dd"));

      const sharedExpenses = (await decryptShared(sharedExpensesRaw || [])) as any[];

      let expensesYouPaid = 0;
      let expensesTheyPaid = 0;

      (sharedExpenses || []).forEach((exp) => {
        const amount = parseFloat((exp.amount || 0).toString());
        if (exp.paid_by === "user") {
          expensesYouPaid += amount;
        } else {
          expensesTheyPaid += amount;
        }
      });

      const amountOwedFromIncome = incomeReceived - yourShareOfIncome;
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

  const toggleExpand = (coParentId: string) => {
    setExpandedCards(prev => ({ ...prev, [coParentId]: !prev[coParentId] }));
  };

  if (coParents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {coParents.map((coParent) => {
        const settlement = settlements[coParent.id];
        if (!settlement) return null;

        const isExpanded = expandedCards[coParent.id] || false;
        const isOwing = settlement.netAmount >= 0;

        return (
          <div
            key={coParent.id}
            className={`bg-muted/40 rounded-lg border ${isOwing ? 'border-amber-500/30' : 'border-green-500/30'}`}
          >
            {/* Header - Always Visible */}
            <div
              className="p-4 cursor-pointer hover:bg-muted/60 transition-colors"
              onClick={() => toggleExpand(coParent.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HandCoins className={`h-5 w-5 ${isOwing ? 'text-amber-500' : 'text-green-500'}`} />
                  <div>
                    <p className="font-medium">Settlement with {coParent.name}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(currentMonth), "MMMM yyyy")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-lg font-bold ${isOwing ? 'text-amber-500' : 'text-green-500'}`}>
                      {isOwing ? '' : '+'}{Math.abs(settlement.netAmount).toFixed(0)} {currency}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isOwing ? 'You owe' : 'They owe'}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-4 border-t border-border/50">
                <div className="space-y-2 text-sm pt-3">
                  {/* Income Section */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shared Income Received</span>
                    <span className="text-green-500">+{settlement.incomeReceived.toFixed(0)} {currency}</span>
                  </div>
                  <div className="flex justify-between text-xs pl-4">
                    <span className="text-muted-foreground">
                      Your {settlement.yourShareOfIncome > 0 ? (settlement.yourShareOfIncome / settlement.incomeReceived * 100).toFixed(0) : 0}% to keep
                    </span>
                    <span className="text-muted-foreground">-{settlement.yourShareOfIncome.toFixed(0)} {currency}</span>
                  </div>

                  {/* Insurance Section */}
                  {settlement.insurancePaid > 0 && (
                    <>
                      <div className="flex justify-between pt-2">
                        <span className="text-muted-foreground">Insurance paid</span>
                        <span>-{settlement.insurancePaid.toFixed(0)} {currency}</span>
                      </div>
                      <div className="flex justify-between text-xs pl-4">
                        <span className="text-muted-foreground">
                          Their {((settlement.theirShareOfInsurance / settlement.insurancePaid) * 100).toFixed(0)}% credit
                        </span>
                        <span className="text-green-500">+{settlement.theirShareOfInsurance.toFixed(0)} {currency}</span>
                      </div>
                    </>
                  )}

                  {/* Expenses Section */}
                  {settlement.expensesTheyPaid > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expenses they paid (your 50%)</span>
                      <span className="text-green-500">+{(settlement.expensesTheyPaid / 2).toFixed(0)} {currency}</span>
                    </div>
                  )}

                  {settlement.expensesYouPaid > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expenses you paid (their 50%)</span>
                      <span className="text-red-500">-{(settlement.expensesYouPaid / 2).toFixed(0)} {currency}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
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
                        size="sm"
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
                          Confirm that you've {isOwing ? 'sent' : 'received'} {Math.abs(settlement.netAmount).toFixed(0)} {currency} {isOwing ? 'to' : 'from'} {coParent.name}
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
                  <Button variant="outline" size="sm" className="px-3">
                    <History className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};