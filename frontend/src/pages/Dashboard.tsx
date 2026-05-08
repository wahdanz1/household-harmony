import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { format } from "date-fns";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { CoParentSettlementCard } from "@/components/dashboard/CoParentSettlementCard";
import { MonthlyReviewWizard, useMonthlyReviewStatus } from "@/components/dashboard/MonthlyReviewWizard";
import { TrendingUp, TrendingDown, PiggyBank, Repeat, Shield, ClipboardCheck, ChevronRight } from "lucide-react";
import { LoadingState } from "@/components/shared/states";
import { SummaryCard } from "@/components/shared/SummaryCard";
import {
  useEncryptedFields,
  monthlyIncomeFields,
  monthlyExpenseFields,
  subscriptionFields,
  insuranceFields,
  sharedExpenseFields
} from "@/hooks/useEncryptedFields";
import { VaultLockedAlert } from "@/components/shared/VaultLockedAlert";
import { useEncryption } from "@/contexts/EncryptionContext";
import { DemoEncryptionCard } from "@/components/demo/DemoEncryptionCard";
import { isDemoMode } from "@/utils/demoMode";
import { reportSuccess, reportFailure, isDown } from "@/utils/outageMonitor";

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
  const { isUnlocked } = useEncryption();
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
  const [reviewWizardOpen, setReviewWizardOpen] = useState(false);

  const { needsReview, markAsReviewed } = useMonthlyReviewStatus(household?.id, financialMonthStart);

  // Encryption hooks
  const { decryptRecords: decryptIncomes } = useEncryptedFields(monthlyIncomeFields);
  const { decryptRecords: decryptExpenses } = useEncryptedFields(monthlyExpenseFields);
  const { decryptRecords: decryptSubscriptions } = useEncryptedFields(subscriptionFields);
  const { decryptRecords: decryptInsurances } = useEncryptedFields(insuranceFields);
  // Credit card expenses now use expenses table with is_credit=true
  const { decryptRecords: decryptShared } = useEncryptedFields(sharedExpenseFields);

  useEffect(() => {
    const fetchData = async () => {
      // If vault is locked, we can't fetch meaningful data, so stop early (or wait for unlock)
      if (!user || !household?.id || householdLoading) return;

      // If locked, we rely on the VaultLockedAlert to tell the user; 
      // but we still let it run to clear loading state if desired, 
      // though typically we'll return early in render.
      // However, to avoid NaN calculations, we should only process if unlocked.
      if (!isUnlocked) {
        setLoading(false);
        return;
      }

      // Skip fetch entirely while the outage monitor is tripped.
      if (isDown()) {
        setLoading(false);
        return;
      }

      setHouseholdId(household.id);

      const fms = household?.financial_month_start || 25;
      const fetchMonth = getCurrentFinancialMonth(fms);
      const { start: fetchStart, end: fetchEnd } = getFinancialMonthRange(fetchMonth, fms);
      const startStr = format(fetchStart, "yyyy-MM-dd");
      const endStr = format(fetchEnd, "yyyy-MM-dd");

      let results;
      try {
        results = await Promise.all([
          supabase.from("monthly_incomes").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
          supabase.from("monthly_expenses").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
          supabase.from("subscriptions").select("encrypted_amount, billing_cycle, billing_month, billing_day, is_encrypted").eq("household_id", household.id).eq("is_active", true),
          supabase.from("insurances").select("encrypted_total_amount, payment_frequency, is_shared, share_percentage, is_encrypted").eq("household_id", household.id).eq("is_active", true),
          supabase.from("shared_expenses").select("encrypted_amount, paid_by, is_encrypted").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
        ]);
      } catch (err) {
        reportFailure(err);
        setLoading(false);
        return;
      }

      const firstError = results.find(r => r.error)?.error;
      if (firstError) {
        reportFailure(firstError);
        setLoading(false);
        return;
      }
      reportSuccess();

      const [
        { data: monthlyIncomes },
        { data: monthlyExpenses },
        { data: subscriptions },
        { data: insurances },
        { data: sharedExpenses },
      ] = results;

      // Decrypt all data //
      const decryptedIncomes = await decryptIncomes(monthlyIncomes || []);
      const decryptedExpenses = await decryptExpenses(monthlyExpenses || []);
      const decryptedSubs = await decryptSubscriptions(subscriptions || []);
      const decryptedInsurances = await decryptInsurances(insurances || []);
      // Credit card expenses now tracked via expenses.is_credit
      const decryptedShared = await decryptShared(sharedExpenses || []);

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

      const uniqueIncomes = deduplicateItems(decryptedIncomes, "income_source_id");
      const uniqueExpenses = deduplicateItems(decryptedExpenses, "expense_id");

      const totalIncome = uniqueIncomes.reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0);
      const totalMonthlyExpenses = uniqueExpenses.reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0);

      // Calculate subscriptions - Logic matches Expenses page (Cash Flow based)
      let subscriptionsMonthly = 0;
      let subscriptionsYearly = 0;
      decryptedSubs.forEach((sub: any) => {
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
      decryptedInsurances.forEach((ins: any) => {
        const totalAmount = parseFloat(ins.total_amount || "0"); // Handle string/number mismatch
        let monthlyAmount = 0;
        let yearlyAmount = 0;

        if (ins.payment_frequency === "yearly") {
          monthlyAmount = totalAmount / 12;
          yearlyAmount = totalAmount;
        } else if (ins.payment_frequency === "semi_annually") {
          monthlyAmount = totalAmount / 6;
          yearlyAmount = totalAmount * 2;
        } else if (ins.payment_frequency === "quarterly") {
          monthlyAmount = totalAmount / 3;
          yearlyAmount = totalAmount * 4;
        } else {
          monthlyAmount = totalAmount;
          yearlyAmount = totalAmount * 12;
        }

        if (ins.is_shared) {
          const shareRatio = (ins.share_percentage || 50) / 100;
          monthlyAmount *= shareRatio;
          yearlyAmount *= shareRatio;
        }

        insuranceMonthly += monthlyAmount;
        insuranceYearly += yearlyAmount;
      });

      // Credit card expenses now included in regular monthly_expenses via expenses.is_credit flag
      const totalShared = decryptedShared.reduce((sum: number, item: any) => {
        return sum + (item.paid_by === "user" ? (parseFloat(item.amount) || 0) : -(parseFloat(item.amount) || 0));
      }, 0);

      const totalExpenses = totalMonthlyExpenses + subscriptionsMonthly + insuranceMonthly + totalShared;

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
  }, [user, household, householdLoading, isUnlocked]); // added isUnlocked dependency

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  };

  if (householdLoading || loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" />
        <LoadingState />
      </div>
    );
  }

  // If locked, show alert instead of dashboard metrics
  if (!isUnlocked) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" />
        <VaultLockedAlert />
      </div>
    );
  }

  const balance = data.income - data.expenses;
  const isPositive = balance >= 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard" />

      {/* Monthly Review Banner - hidden for demo users (data resets anyway) */}
      {needsReview && localStorage.getItem('is_demo_mode') !== 'true' && (
        <div
          className="p-4 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-between cursor-pointer hover:bg-primary/15 transition-colors"
          onClick={() => setReviewWizardOpen(true)}
        >
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">New month! Review your finances</p>
              <p className="text-xs text-muted-foreground">Confirm your income and expenses are up to date</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-primary" />
        </div>
      )}

      {/* Demo Encryption Showcase - only visible in demo mode */}
      <DemoEncryptionCard householdId={householdId} />

      {/* Metric Cards - with reduced opacity when review pending (not in demo) */}
      <div className={`space-y-3 ${needsReview && !isDemoMode() ? 'opacity-50' : ''} transition-opacity`}>
        {/* Row 1: Balance - Full Width, More Prominent */}
        <Card className={`border-2 ${isPositive ? 'border-green-500/40' : 'border-red-500/40'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <PiggyBank className={`h-5 w-5 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
                <span className="text-sm text-muted-foreground">Monthly Balance</span>
              </div>
              <p className={`text-3xl font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{formatCurrency(balance)} {currency}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {isPositive ? 'Surplus' : 'Deficit'}
            </p>
          </div>
        </Card>

        {/* Row 2: Income | Expenses - 50/50 */}
        <div className="grid-2 gap-3">
          <SummaryCard
            title="Income"
            icon={TrendingUp}
            amount={formatCurrency(data.income)}
            periodLabel="This month"
            color="green"
            currency={currency}
            onClick={() => navigate('/income')}
          />
          <SummaryCard
            title="Expenses"
            icon={TrendingDown}
            amount={formatCurrency(data.expenses)}
            periodLabel="This month"
            color="red"
            currency={currency}
            onClick={() => navigate('/expenses')}
          />
        </div>

        {/* Row 3: Subscriptions | Insurance - 50/50 */}
        <div className="grid-2 gap-3">
          <SummaryCard
            title="Subscriptions"
            icon={Repeat}
            amount={formatCurrency(data.subscriptionsMonthly)}
            periodLabel={`${formatCurrency(data.subscriptionsYearly)}/yr`}
            color="purple"
            currency={currency}
            onClick={() => navigate('/expenses?tab=all')}
          />
          <SummaryCard
            title="Insurance"
            icon={Shield}
            amount={formatCurrency(data.insuranceMonthly)}
            periodLabel={`${formatCurrency(data.insuranceYearly)}/yr`}
            color="amber"
            currency={currency}
            onClick={() => navigate('/expenses?tab=all')}
          />
        </div>
      </div>

      {/* Co-Parent Settlement (if applicable) */}
      {householdId && coParents.length > 0 && (
        <CoParentSettlementCard householdId={householdId} currency={currency} />
      )}

      {/* Monthly Review Wizard */}
      <MonthlyReviewWizard
        open={reviewWizardOpen}
        onOpenChange={setReviewWizardOpen}
        onComplete={markAsReviewed}
      />
    </div>
  );
};

export default Dashboard;