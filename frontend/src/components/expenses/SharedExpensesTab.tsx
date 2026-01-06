import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CoParentManagement } from "./shared/CoParentManagement";
import { SharedExpensesList } from "./shared/SharedExpensesList";
import { useEncryptedFields, sharedExpenseFields } from "@/hooks/useEncryptedFields";

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
  }, [householdId]);

  const totalSharedExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0);

  const expensesByCoParent = expenses.reduce((acc, exp) => {
    if (!acc[exp.co_parent_id]) {
      acc[exp.co_parent_id] = [];
    }
    acc[exp.co_parent_id].push(exp);
    return acc;
  }, {} as Record<string, SharedExpense[]>);

  return (
    <div className="space-y-6">
      {/* Combined Summary and Management Card */}
      <Card>
        <CardContent>
          <div className="grid gap-8 md:grid-cols-2">
            {/* Summary Section */}
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Shared Expenses Summary</h3>
                <p className="text-sm text-muted-foreground">Track expenses you share with co-parents</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total this month</p>
                <p className="text-3xl font-bold text-warning">
                  {totalSharedExpenses.toFixed(0)} {currency}
                </p>
              </div>
            </div>

            {/* Co-Parent Management Section */}
            <CoParentManagement
              householdId={householdId}
              coParents={coParents}
              onUpdate={fetchData}
            />
          </div>
        </CardContent>
      </Card>

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