import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth } from "date-fns";
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

  const currentMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      const { data: householdData } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", user.id)
        .single();

      if (!householdData) return;

      setHouseholdId(householdData.household_id);

      const [
        { data: householdInfo },
        { data: monthlyIncomes },
        { data: monthlyExpenses },
        { data: subscriptions },
        { data: insurances },
        { data: creditCardExpenses },
        { data: sharedExpenses },
      ] = await Promise.all([
        supabase.from("households").select("currency").eq("id", householdData.household_id).single(),
        supabase.from("monthly_incomes").select("amount").eq("household_id", householdData.household_id).eq("month", currentMonth),
        supabase.from("monthly_expenses").select("amount").eq("household_id", householdData.household_id).eq("month", currentMonth),
        supabase.from("subscriptions").select("amount").eq("household_id", householdData.household_id).eq("is_active", true),
        supabase.from("insurances").select("total_amount, payment_frequency, is_shared, share_percentage").eq("household_id", householdData.household_id).eq("is_active", true),
        supabase.from("credit_card_expenses").select("amount").eq("household_id", householdData.household_id).eq("month", currentMonth),
        supabase.from("shared_expenses").select("amount, paid_by").eq("household_id", householdData.household_id).eq("month", currentMonth),
      ]);

      const totalIncome = (monthlyIncomes || []).reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);
      const totalMonthlyExpenses = (monthlyExpenses || []).reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);
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
  }, [user, currentMonth]);

  const displayMonth = new Date().toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long'
  });

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
        <p className="text-muted-foreground mt-1 capitalize">{displayMonth}</p>
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