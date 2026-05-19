import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { CoParentManagement } from "./shared/CoParentManagement";
import { SharedExpensesList } from "./shared/SharedExpensesList";
import { SharedExpenseForm } from "./forms/SharedExpenseForm";
import { useEncryptedFields, sharedExpenseFields } from "@/hooks/useEncryptedFields";
import { EmptyStateCard } from "@/components/shared/EmptyStateCard";

interface SharedExpense {
  id: string;
  description: string;
  amount: number;
  notes: string | null;
  co_parent_id: string;
  created_at: string;
  paid_by: "user" | "co_parent";
}

interface CoParent {
  id: string;
  name: string;
  notes: string | null;
}

interface SharedExpensesTabProps {
  householdId: string;
  currency: string;
  monthStart: Date;
  monthEnd: Date;
}

export const SharedExpensesTab = ({ householdId, currency, monthStart, monthEnd }: SharedExpensesTabProps) => {
  const [coParents, setCoParents] = useState<CoParent[]>([]);
  const [expenses, setExpenses] = useState<SharedExpense[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addCoParentOpen, setAddCoParentOpen] = useState(false);
  const { decryptRecords: decryptSharedExpenses } = useEncryptedFields(sharedExpenseFields);

  const fetchData = async () => {
    const [{ data: coParentsData }, { data: expensesData }] = await Promise.all([
      supabase.from("co_parents").select("*").eq("household_id", householdId),
      supabase
        .from("shared_expenses")
        .select("*, co_parents(name)")
        .eq("household_id", householdId)
        .gte("month_end", format(monthStart, "yyyy-MM-dd"))
        .lte("month_start", format(monthEnd, "yyyy-MM-dd"))
        .order("created_at", { ascending: false }),
    ]);

    setCoParents(coParentsData || []);

    // Decrypt shared expenses
    const decryptedExpenses = await decryptSharedExpenses(expensesData || []) as SharedExpense[];
    setExpenses(decryptedExpenses);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const totalSharedExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0);

  const expensesByCoParent = expenses.reduce((acc, exp) => {
    if (!acc[exp.co_parent_id]) {
      acc[exp.co_parent_id] = [];
    }
    acc[exp.co_parent_id].push(exp);
    return acc;
  }, {} as Record<string, SharedExpense[]>);

  if (coParents.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyStateCard
          icon={Users}
          iconClassName="text-accent"
          headline="No co-parents yet"
          description="Add a co-parent to start tracking shared expenses and settlements with them."
          primaryLabel="Add your first co-parent"
          onPrimary={() => setAddCoParentOpen(true)}
          hideWizardLink
        />
        <CoParentManagement
          householdId={householdId}
          coParents={coParents}
          onUpdate={fetchData}
          addOpen={addCoParentOpen}
          onAddOpenChange={setAddCoParentOpen}
          dialogOnly
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <h3>Shared Expenses Summary</h3>
              <p className="text-sm text-muted">Track expenses you share with co-parents</p>
            </div>
            <div>
              <p className="text-sm text-muted">Total this month</p>
              <Money v={totalSharedExpenses} currency={currency} size="3xl" weight={600} className="tracking-tight" />
            </div>
          </div>

          <CoParentManagement
            householdId={householdId}
            coParents={coParents}
            onUpdate={fetchData}
          />
        </div>
      </Card>

      {coParents.length > 0 && (
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="w-full justify-center gap-2">
              <Plus className="h-4 w-4" />
              Add shared expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New shared expense</DialogTitle>
            </DialogHeader>
            <SharedExpenseForm
              householdId={householdId}
              onSuccess={() => {
                setAddDialogOpen(false);
                fetchData();
              }}
              onCancel={() => setAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {coParents.length === 0 ? null : (
        <SharedExpensesList
          householdId={householdId}
          currency={currency}
          monthStart={monthStart}
          monthEnd={monthEnd}
          coParents={coParents}
          expenses={expenses}
          totalSharedExpenses={totalSharedExpenses}
          expensesByCoParent={expensesByCoParent}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
};