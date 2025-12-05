import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveHousehold } from "@/utils/householdHelpers";
import { format } from "date-fns";
import { getCurrentFinancialMonth, getFinancialMonthRange, formatFinancialMonth } from "@/utils/dateUtils";
import MonthOverview from "@/components/dashboard/MonthOverview";
import QuickActions from "@/components/dashboard/QuickActions";
import SavingsGoalsPreview from "@/components/dashboard/SavingsGoalsPreview";
import { CoParentSettlementCard } from "@/components/dashboard/CoParentSettlementCard";

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [currency, setCurrency] = useState("SEK");
  const [householdId, setHouseholdId] = useState<string>("");

  const currentMonth = getCurrentFinancialMonth();
  const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      const { membership } = await getActiveHousehold(user.id);

      if (!membership) return;

      setHouseholdId(membership.household_id);

      const [
        { data: householdInfo },
        { data: monthlyIncomes },
        { data: monthlyExpenses },
        { data: subscriptions },
        { data: insurances },
        { data: creditCardExpenses },
        { data: sharedExpenses },
      ] = await Promise.all([
        supabase.from("households").select("currency").eq("id", membership.household_id).single(),
        supabase.from("monthly_incomes").select("*").eq("household_id", membership.household_id).gte("month_end", format(monthStart, "yyyy-MM-dd")).lte("month_start", format(monthEnd, "yyyy-MM-dd")),
        supabase.from("monthly_expenses").select("*").eq("household_id", membership.household_id).gte("month_end", format(monthStart, "yyyy-MM-dd")).lte("month_start", format(monthEnd, "yyyy-MM-dd")),
        supabase.from("subscriptions").select("amount").eq("household_id", membership.household_id).eq("is_active", true),
        supabase.from("insurances").select("total_amount, payment_frequency, is_shared, share_percentage").eq("household_id", membership.household_id).eq("is_active", true),
        supabase.from("credit_card_expenses").select("amount").eq("household_id", membership.household_id).gte("month_end", format(monthStart, "yyyy-MM-dd")).lte("month_start", format(monthEnd, "yyyy-MM-dd")),
        supabase.from("shared_expenses").select("amount, paid_by").eq("household_id", membership.household_id).gte("month_end", format(monthStart, "yyyy-MM-dd")).lte("month_start", format(monthEnd, "yyyy-MM-dd")),
      ]);

      // Helper to deduplicate recurring items (which might have duplicate rows for Calendar vs Financial months)
      const deduplicateItems = (items: any[], sourceIdField: string) => {
        const uniqueItems: Record<string, any> = {};
        const oneTimeItems: any[] = [];

        (items || []).forEach(item => {
          const sourceId = item[sourceIdField];
          if (sourceId) {
            // It's a recurring item
            if (uniqueItems[sourceId]) {
              // If we already have this source, keep the newer one
              const existingDate = new Date(uniqueItems[sourceId].updated_at || uniqueItems[sourceId].created_at);
              const newDate = new Date(item.updated_at || item.created_at);
              if (newDate > existingDate) {
                uniqueItems[sourceId] = item;
              }
            } else {
              uniqueItems[sourceId] = item;
            }
          } else {
            // It's a one-time item, keep it
            oneTimeItems.push(item);
          }
        });

        return [...Object.values(uniqueItems), ...oneTimeItems];
      };

      const uniqueIncomes = deduplicateItems(monthlyIncomes || [], "income_source_id");
      const uniqueExpenses = deduplicateItems(monthlyExpenses || [], "regular_expense_id");

      const totalIncome = uniqueIncomes.reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);
      const totalMonthlyExpenses = uniqueExpenses.reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);
      const totalSubscriptions = (subscriptions || []).reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);
      const totalInsurance = (insurances || []).reduce((sum: number, ins: any) => {
        let monthlyAmount = 0;
        if (ins.payment_frequency === "yearly") monthlyAmount = ins.total_amount / 12;
        else if (ins.payment_frequency === "semi_annually") monthlyAmount = ins.total_amount / 6;
        else if (ins.payment_frequency === "quarterly") monthlyAmount = ins.total_amount / 3;
        else monthlyAmount = ins.total_amount; // monthly

        if (ins.is_shared) {
          monthlyAmount = monthlyAmount * (ins.share_percentage / 100);
        }
        return sum + monthlyAmount;
      }, 0);
      const totalCreditCard = (creditCardExpenses || []).reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);
      const totalShared = (sharedExpenses || []).reduce((sum: number, item: any) => {
        // If paid by user, add to expenses; if paid by co-parent, subtract (they paid for you)
        return sum + (item.paid_by === "user" ? parseFloat(item.amount) : -parseFloat(item.amount));
      }, 0);

      setIncome(totalIncome);
      setExpenses(totalMonthlyExpenses + totalSubscriptions + totalInsurance + totalCreditCard + totalShared);
      setCurrency(householdInfo?.currency || "SEK");
      setLoading(false);
    };

    fetchData();
  }, [user, currentMonth]); // Re-fetch if financial month changes

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 capitalize">{formatFinancialMonth(currentMonth)}</p>
      </div>

      <MonthOverview
        income={income}
        expenses={expenses}
        currency={currency}
      />

      <QuickActions />

      {householdId && (
        <CoParentSettlementCard householdId={householdId} currency={currency} />
      )}

      <SavingsGoalsPreview currency={currency} />
    </div>
  );
};

export default Dashboard;