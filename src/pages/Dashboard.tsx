import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth } from "date-fns";
import MonthOverview from "@/components/dashboard/MonthOverview";
import QuickActions from "@/components/dashboard/QuickActions";
import SavingsGoalsPreview from "@/components/dashboard/SavingsGoalsPreview";

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [currency, setCurrency] = useState("SEK");

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

      const [
        { data: householdInfo },
        { data: monthlyIncomes },
        { data: monthlyExpenses },
        { data: subscriptions },
        { data: insurances },
      ] = await Promise.all([
        supabase.from("households").select("currency").eq("id", householdData.household_id).single(),
        supabase.from("monthly_incomes").select("amount").eq("household_id", householdData.household_id).eq("month", currentMonth),
        supabase.from("monthly_expenses").select("amount").eq("household_id", householdData.household_id).eq("month", currentMonth),
        supabase.from("subscriptions").select("amount").eq("household_id", householdData.household_id).eq("is_active", true),
        supabase.from("insurances").select("total_amount, payment_frequency").eq("household_id", householdData.household_id).eq("is_active", true),
      ]);

      const totalIncome = (monthlyIncomes || []).reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);
      const totalMonthlyExpenses = (monthlyExpenses || []).reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);
      const totalSubscriptions = (subscriptions || []).reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);
      const totalInsurance = (insurances || []).reduce((sum: number, ins: any) => {
        const frequency = ins.payment_frequency === "yearly" ? 12 : ins.payment_frequency === "semi-annual" ? 6 : 3;
        return sum + parseFloat(ins.total_amount) / frequency;
      }, 0);

      setIncome(totalIncome);
      setExpenses(totalMonthlyExpenses + totalSubscriptions + totalInsurance);
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

      <SavingsGoalsPreview currency={currency} />
    </div>
  );
};

export default Dashboard;