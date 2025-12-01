import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { CoParentManagement } from "./shared/CoParentManagement";
import { SharedExpensesList } from "./shared/SharedExpensesList";

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
    setExpenses(expensesData || []);
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
      {/* Co-Parent Management */}
      <CoParentManagement
        householdId={householdId}
        coParents={coParents}
        onUpdate={fetchData}
      />

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