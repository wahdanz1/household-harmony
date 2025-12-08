import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { format } from "date-fns";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
import { PageHeader } from "@/components/shared/PageHeader";
import SavingsGoalsPreview from "@/components/dashboard/SavingsGoalsPreview";
import { CoParentSettlementCard } from "@/components/dashboard/CoParentSettlementCard";
import { TrendingUp, TrendingDown, PiggyBank, Repeat, Shield } from "lucide-react";

interface DashboardData {
  income: number;
  expenses: number;
  subscriptionsMonthly: number;
  subscriptionsYearly: number;
  insuranceMonthly: number;
  insuranceYearly: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { household, coParents, financialMonthStart, loading: householdLoading } = useHousehold();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    income: 0,
    expenses: 0,
    subscriptionsMonthly: 0,
    subscriptionsYearly: 0,
    insuranceMonthly: 0,
    insuranceYearly: 0,
  });
  const [currency, setCurrency] = useState("SEK");
  const [householdId, setHouseholdId] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !household?.id || householdLoading) return;

      setHouseholdId(household.id);

      const fms = household?.financial_month_start || 25;
      const fetchMonth = getCurrentFinancialMonth(fms);
      const { start: fetchStart, end: fetchEnd } = getFinancialMonthRange(fetchMonth, fms);
      const startStr = format(fetchStart, "yyyy-MM-dd");
      const endStr = format(fetchEnd, "yyyy-MM-dd");

      const [
        { data: monthlyIncomes },
        { data: monthlyExpenses },
        { data: subscriptions },
        { data: insurances },
        { data: creditCardExpenses },
        { data: sharedExpenses },
      ] = await Promise.all([
        supabase.from("monthly_incomes").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
        supabase.from("monthly_expenses").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
        supabase.from("subscriptions").select("amount, billing_cycle, billing_month, billing_day").eq("household_id", household.id).eq("is_active", true),
        supabase.from("insurances").select("total_amount, payment_frequency, is_shared, share_percentage").eq("household_id", household.id).eq("is_active", true),
        supabase.from("credit_card_expenses").select("amount").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
        supabase.from("shared_expenses").select("amount, paid_by").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
      ]);

      // Helper to deduplicate recurring items
      const deduplicateItems = (items: any[], sourceIdField: string) => {
        const uniqueItems: Record<string, any> = {};
        const oneTimeItems: any[] = [];

        (items || []).forEach(item => {
          const sourceId = item[sourceIdField];
          if (sourceId) {
            if (uniqueItems[sourceId]) {
              const existingDate = new Date(uniqueItems[sourceId].updated_at || uniqueItems[sourceId].created_at);
              const newDate = new Date(item.updated_at || item.created_at);
              if (newDate > existingDate) {
                uniqueItems[sourceId] = item;
              }
            } else {
              uniqueItems[sourceId] = item;
            }
          } else {
            oneTimeItems.push(item);
          }
        });

        return [...Object.values(uniqueItems), ...oneTimeItems];
      };

      const uniqueIncomes = deduplicateItems(monthlyIncomes || [], "income_source_id");
      const uniqueExpenses = deduplicateItems(monthlyExpenses || [], "regular_expense_id");

      const totalIncome = uniqueIncomes.reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);
      const totalMonthlyExpenses = uniqueExpenses.reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);

      // Calculate subscriptions - Logic matches Expenses page (Cash Flow based)
      // - Monthly: always counts
      // - Quarterly/Yearly: counts full amount ONLY if due this month
      let subscriptionsMonthly = 0;
      let subscriptionsYearly = 0;
      (subscriptions || []).forEach((sub: any) => {
        const amount = parseFloat(sub.amount || "0");

        // Yearly Projection
        if (sub.billing_cycle === "yearly") {
          subscriptionsYearly += amount;
        } else if (sub.billing_cycle === "quarterly") {
          subscriptionsYearly += amount * 4;
        } else {
          subscriptionsYearly += amount * 12;
        }

        // Monthly Cost (Cash Flow / Due This Month)
        if (sub.billing_cycle === "monthly") {
          subscriptionsMonthly += amount;
        } else if (sub.billing_cycle === "yearly") {
          if (sub.billing_month && sub.billing_day) {
            const dateInStartYear = new Date(fetchStart.getFullYear(), sub.billing_month - 1, sub.billing_day);
            const dateInEndYear = new Date(fetchEnd.getFullYear(), sub.billing_month - 1, sub.billing_day);
            const isDue = (dateInStartYear >= fetchStart && dateInStartYear <= fetchEnd) ||
              (dateInEndYear >= fetchStart && dateInEndYear <= fetchEnd);
            if (isDue) subscriptionsMonthly += amount;
          }
        } else if (sub.billing_cycle === "quarterly") {
          if (sub.billing_month && sub.billing_day) {
            const billingMonths = [
              sub.billing_month - 1,
              (sub.billing_month - 1 + 3) % 12,
              (sub.billing_month - 1 + 6) % 12,
              (sub.billing_month - 1 + 9) % 12
            ];
            const isDue = billingMonths.some(monthIndex => {
              const dateInStartYear = new Date(fetchStart.getFullYear(), monthIndex, sub.billing_day!);
              const dateInEndYear = new Date(fetchEnd.getFullYear(), monthIndex, sub.billing_day!);
              return (dateInStartYear >= fetchStart && dateInStartYear <= fetchEnd) ||
                (dateInEndYear >= fetchStart && dateInEndYear <= fetchEnd);
            });
            if (isDue) subscriptionsMonthly += amount;
          }
        }
      });

      // Calculate insurance - track both monthly equivalent and yearly total
      let insuranceMonthly = 0;
      let insuranceYearly = 0;
      (insurances || []).forEach((ins: any) => {
        let monthlyAmount = 0;
        let yearlyAmount = 0;

        if (ins.payment_frequency === "yearly") {
          monthlyAmount = ins.total_amount / 12;
          yearlyAmount = ins.total_amount;
        } else if (ins.payment_frequency === "semi_annually") {
          monthlyAmount = ins.total_amount / 6;
          yearlyAmount = ins.total_amount * 2;
        } else if (ins.payment_frequency === "quarterly") {
          monthlyAmount = ins.total_amount / 3;
          yearlyAmount = ins.total_amount * 4;
        } else {
          monthlyAmount = ins.total_amount;
          yearlyAmount = ins.total_amount * 12;
        }

        if (ins.is_shared) {
          const shareRatio = ins.share_percentage / 100;
          monthlyAmount *= shareRatio;
          yearlyAmount *= shareRatio;
        }

        insuranceMonthly += monthlyAmount;
        insuranceYearly += yearlyAmount;
      });

      const totalCreditCard = (creditCardExpenses || []).reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);
      const totalShared = (sharedExpenses || []).reduce((sum: number, item: any) => {
        return sum + (item.paid_by === "user" ? parseFloat(item.amount) : -parseFloat(item.amount));
      }, 0);

      const totalExpenses = totalMonthlyExpenses + subscriptionsMonthly + insuranceMonthly + totalCreditCard + totalShared;

      setData({
        income: totalIncome,
        expenses: totalExpenses,
        subscriptionsMonthly,
        subscriptionsYearly,
        insuranceMonthly,
        insuranceYearly,
      });
      setCurrency(household.currency || "SEK");
      setLoading(false);
    };

    fetchData();
  }, [user, household, householdLoading]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  };

  if (householdLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const balance = data.income - data.expenses;
  const isPositive = balance >= 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard" />

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Monthly Balance */}
        <div className={`bg-muted/40 rounded-lg p-4 border ${isPositive ? 'border-green-500/30' : 'border-red-500/30'}`}>
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className={`h-4 w-4 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
            <span className="text-xs text-muted-foreground">Balance</span>
          </div>
          <p className={`text-xl font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{formatCurrency(balance)} {currency}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isPositive ? 'Surplus' : 'Deficit'}
          </p>
        </div>

        {/* Total Income */}
        <div
          className="bg-muted/40 rounded-lg p-4 border border-primary/20 hover:bg-muted/60 cursor-pointer transition-colors"
          onClick={() => navigate('/income')}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Income</span>
          </div>
          <p className="text-xl font-bold text-green-500">
            {formatCurrency(data.income)} {currency}
          </p>
          <p className="text-xs text-muted-foreground mt-1">This month</p>
        </div>

        {/* Total Expenses */}
        <div
          className="bg-muted/40 rounded-lg p-4 border border-primary/20 hover:bg-muted/60 cursor-pointer transition-colors"
          onClick={() => navigate('/expenses')}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground">Expenses</span>
          </div>
          <p className="text-xl font-bold text-red-500">
            {formatCurrency(data.expenses)} {currency}
          </p>
          <p className="text-xs text-muted-foreground mt-1">This month</p>
        </div>

        {/* Subscriptions */}
        <div
          className="bg-muted/40 rounded-lg p-4 border border-primary/20 hover:bg-muted/60 cursor-pointer transition-colors"
          onClick={() => navigate('/expenses?tab=all')}
        >
          <div className="flex items-center gap-2 mb-2">
            <Repeat className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Subscriptions</span>
          </div>
          <p className="text-xl font-bold text-foreground">
            {formatCurrency(data.subscriptionsMonthly)} {currency}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(data.subscriptionsYearly)}/yr
          </p>
        </div>

        {/* Insurance */}
        <div
          className="bg-muted/40 rounded-lg p-4 border border-primary/20 hover:bg-muted/60 cursor-pointer transition-colors"
          onClick={() => navigate('/expenses?tab=all')}
        >
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Insurance</span>
          </div>
          <p className="text-xl font-bold text-foreground">
            {formatCurrency(data.insuranceMonthly)} {currency}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(data.insuranceYearly)}/yr
          </p>
        </div>
      </div>

      {/* Co-Parent Settlement (if applicable) */}
      {householdId && coParents.length > 0 && (
        <CoParentSettlementCard householdId={householdId} currency={currency} />
      )}

      {/* Savings Goals */}
      <SavingsGoalsPreview currency={currency} />
    </div>
  );
};

export default Dashboard;