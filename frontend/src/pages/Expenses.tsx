import { useEffect, useState, useRef, useCallback } from "react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, CreditCard, Shield, ShoppingBag } from "lucide-react";
import { MonthlyExpenses } from "@/components/expenses/MonthlyExpenses";
import { SubscriptionsTab } from "@/components/expenses/SubscriptionsTab";
import { InsuranceTab } from "@/components/expenses/InsuranceTab";
import { SharedExpensesTab } from "@/components/expenses/SharedExpensesTab";
import { CreditTab } from "@/components/expenses/CreditTab";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";

const Expenses = () => {
  const { user } = useAuth();
  const { household, members, coParents } = useHousehold();
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [insurances, setInsurances] = useState<any[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [creditCardExpenses, setCreditCardExpenses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("general");

  // Autosave state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const financialMonthStart = household?.financial_month_start || 25;
  const currentMonth = getCurrentFinancialMonth(financialMonthStart);
  const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth, financialMonthStart);

  const fetchData = useCallback(async () => {
    if (!user || !household) return;

    const [
      { data: categoriesData },
      { data: monthlyData },
      { data: historicalData },
      { data: subscriptionsData },
      { data: insurancesData },
      { data: creditCardExpensesData },
    ] = await Promise.all([
      supabase.from("regular_expenses").select("*").eq("household_id", household.id).eq("is_active", true).order("sort_order"),
      supabase.from("monthly_expenses").select("*").eq("household_id", household.id).gte("month_end", format(monthStart, "yyyy-MM-dd")).lte("month_start", format(monthEnd, "yyyy-MM-dd")),
      supabase.from("monthly_expenses").select("*").eq("household_id", household.id).lt("month_start", format(monthStart, "yyyy-MM-dd")),
      supabase.from("subscriptions").select("*").eq("household_id", household.id).eq("is_active", true),
      supabase.from("insurances").select("*").eq("household_id", household.id).eq("is_active", true),
      supabase.from("credit_card_expenses").select("*, credit_cards(name)").eq("household_id", household.id).gte("month_end", format(monthStart, "yyyy-MM-dd")).lte("month_start", format(monthEnd, "yyyy-MM-dd")),
    ]);

    setExpenseCategories(categoriesData || []);
    setMonthlyExpenses(monthlyData || []);
    setSubscriptions(subscriptionsData || []);
    setInsurances(insurancesData || []);
    setCreditCardExpenses(creditCardExpensesData || []);

    // Check if there are saved expenses to set initial status
    if ((monthlyData || []).length > 0) {
      setAutoSaveStatus('saved');
    }

    const initialAmounts: Record<string, string> = {};
    (categoriesData || []).forEach((category: any) => {
      const existing = (monthlyData || []).find((m: any) => m.regular_expense_id === category.id);

      // For static expenses, always use the current default amount from the category definition
      if (category.type === "static") {
        initialAmounts[category.id] = category.default_amount.toString();
      } else if (existing) {
        initialAmounts[category.id] = existing.amount.toString();
      } else if (category.type === "dynamic") {
        const previousExpenses = (historicalData || []).filter((h: any) => h.regular_expense_id === category.id);
        if (previousExpenses.length > 0) {
          const total = previousExpenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);
          const avg = total / previousExpenses.length;
          initialAmounts[category.id] = Math.round(avg).toString();
        } else {
          initialAmounts[category.id] = category.default_amount.toString();
        }
      } else {
        initialAmounts[category.id] = category.default_amount.toString();
      }
    });

    setAmounts(initialAmounts);
    setLoading(false);
  }, [user, household, monthStart, monthEnd]);

  useEffect(() => {
    if (household) {
      fetchData();
    }
  }, [household, fetchData]);

  const handleSave = useCallback(async () => {
    if (!household || !user) return;
    setAutoSaveStatus('saving');

    const entries = expenseCategories.map((category) => ({
      regular_expense_id: category.id,
      household_id: household.id,
      month: currentMonth,
      month_start: format(monthStart, "yyyy-MM-dd"),
      month_end: format(monthEnd, "yyyy-MM-dd"),
      amount: parseFloat(amounts[category.id] || "0"),
      created_by: user.id,
    }));

    const { error } = await supabase
      .from("monthly_expenses")
      .upsert(entries as any, { onConflict: "regular_expense_id,month" });

    if (error) {
      setAutoSaveStatus('error');
    } else {
      setAutoSaveStatus('saved');
      fetchData();
    }
  }, [household, user, expenseCategories, amounts, currentMonth, monthStart, monthEnd, fetchData]);

  // Handle amount change with debounced autosave
  const handleAmountChange = useCallback((categoryId: string, value: string) => {
    setAmounts(prev => ({ ...prev, [categoryId]: value }));
    setAutoSaveStatus('idle');

    // Clear previous timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new debounce timer (500ms)
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 500);
  }, [handleSave]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const subscriptionsTotal = subscriptions.reduce((sum, sub) => {
    const amount = parseFloat(sub.amount);

    if (sub.billing_cycle === "monthly") return sum + amount;

    if (sub.billing_cycle === "yearly") {
      if (!sub.billing_month || !sub.billing_day) return sum + amount;
      const dateInStartYear = new Date(monthStart.getFullYear(), sub.billing_month - 1, sub.billing_day);
      const dateInEndYear = new Date(monthEnd.getFullYear(), sub.billing_month - 1, sub.billing_day);
      const isDue = (dateInStartYear >= monthStart && dateInStartYear <= monthEnd) ||
        (dateInEndYear >= monthStart && dateInEndYear <= monthEnd);
      return isDue ? sum + amount : sum;
    }

    return sum + amount;
  }, 0);

  const subscriptionSeverity = subscriptions.reduce((severity, sub) => {
    if (severity === 'danger') return 'danger';

    if (sub.billing_cycle === 'yearly') {
      if (!sub.billing_month || !sub.billing_day) return severity;
      const dateInStartYear = new Date(monthStart.getFullYear(), sub.billing_month - 1, sub.billing_day);
      const dateInEndYear = new Date(monthEnd.getFullYear(), sub.billing_month - 1, sub.billing_day);
      const isDue = (dateInStartYear >= monthStart && dateInStartYear <= monthEnd) ||
        (dateInEndYear >= monthStart && dateInEndYear <= monthEnd);
      if (isDue) return 'danger';
    }

    if (sub.billing_cycle === 'quarterly' && severity !== 'danger') {
      if (!sub.billing_month || !sub.billing_day) return 'warning';
      const billingMonths = [
        sub.billing_month - 1,
        (sub.billing_month - 1 + 3) % 12,
        (sub.billing_month - 1 + 6) % 12,
        (sub.billing_month - 1 + 9) % 12
      ];
      const isDue = billingMonths.some(monthIndex => {
        const dateInStartYear = new Date(monthStart.getFullYear(), monthIndex, sub.billing_day);
        const dateInEndYear = new Date(monthEnd.getFullYear(), monthIndex, sub.billing_day);
        return (dateInStartYear >= monthStart && dateInStartYear <= monthEnd) ||
          (dateInEndYear >= monthStart && dateInEndYear <= monthEnd);
      });
      if (isDue) return 'warning';
    }

    return severity;
  }, 'default' as 'default' | 'warning' | 'danger');

  const insuranceTotal = insurances
    .filter((ins) => ins.is_active)
    .reduce((sum, ins) => {
      let monthlyAmount = 0;
      if (ins.payment_frequency === "yearly") monthlyAmount = ins.total_amount / 12;
      else if (ins.payment_frequency === "semi_annually") monthlyAmount = ins.total_amount / 6;
      else if (ins.payment_frequency === "quarterly") monthlyAmount = ins.total_amount / 3;
      else monthlyAmount = ins.total_amount;

      if (ins.is_shared) {
        monthlyAmount = monthlyAmount * (ins.share_percentage / 100);
      }
      return sum + monthlyAmount;
    }, 0);

  const creditCardTotal = creditCardExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalExpenses = Object.values(amounts).reduce((sum, val) => sum + parseFloat(val || "0"), 0) + subscriptionsTotal + insuranceTotal + creditCardTotal;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Management"
        totalLabel="Total Expenses"
        totalAmount={totalExpenses}
        totalColorClass="text-destructive"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${household?.enable_credit_cards ? (coParents.length > 0 ? 5 : 4) : (coParents.length > 0 ? 4 : 3)}, minmax(0, 1fr))` }}>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Subscriptions</span>
          </TabsTrigger>
          <TabsTrigger value="insurance" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Insurance</span>
          </TabsTrigger>
          {household?.enable_credit_cards && (
            <TabsTrigger value="credit" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Credit</span>
            </TabsTrigger>
          )}
          {coParents.length > 0 && (
            <TabsTrigger value="shared" className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Shared</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <MonthlyExpenses
            householdId={household?.id}
            expenseCategories={expenseCategories}
            monthlyExpenses={monthlyExpenses}
            creditCardExpenses={creditCardExpenses}
            amounts={amounts}
            currency={household?.currency || "SEK"}
            subscriptionsTotal={subscriptionsTotal}
            insuranceTotal={insuranceTotal}
            subscriptionSeverity={subscriptionSeverity}
            members={members}
            coParents={coParents}
            autoSaveStatus={autoSaveStatus}
            onAmountChange={handleAmountChange}
            onCategoriesUpdate={fetchData}
            onNavigateToSubscriptions={() => setActiveTab("subscriptions")}
            onNavigateToInsurance={() => setActiveTab("insurance")}
            onNavigateToCredit={() => setActiveTab("credit")}
          />
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-6">
          <SubscriptionsTab
            householdId={household?.id}
            currency={household?.currency || "SEK"}
          />
        </TabsContent>

        <TabsContent value="insurance" className="mt-6">
          <InsuranceTab
            householdId={household?.id}
            currency={household?.currency || "SEK"}
          />
        </TabsContent>

        {household?.enable_credit_cards && (
          <TabsContent value="credit" className="mt-6">
            <CreditTab
              householdId={household?.id}
              currency={household?.currency || "SEK"}
              monthStart={monthStart}
              monthEnd={monthEnd}
            />
          </TabsContent>
        )}

        {coParents.length > 0 && (
          <TabsContent value="shared" className="mt-6">
            <SharedExpensesTab
              householdId={household?.id}
              currency={household?.currency || "SEK"}
              monthStart={monthStart}
              monthEnd={monthEnd}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Expenses;
