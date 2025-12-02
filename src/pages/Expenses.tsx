import { useEffect, useState } from "react";
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
import { getActiveHousehold } from "@/utils/householdHelpers";
import { useToast } from "@/hooks/use-toast";
import { getCurrentFinancialMonth, getFinancialMonthRange, formatFinancialMonth } from "@/utils/dateUtils";

const Expenses = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [household, setHousehold] = useState<any>(null);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [insurances, setInsurances] = useState<any[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [coParents, setCoParents] = useState<any[]>([]);
  const [creditCardExpenses, setCreditCardExpenses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("general");
  const [hasSaved, setHasSaved] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);

  const currentMonth = getCurrentFinancialMonth();
  const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth);

  const fetchData = async () => {
    if (!user) return;

    const { membership } = await getActiveHousehold(user.id);

    if (!membership) return;

    const [
      { data: householdInfo },
      { data: categoriesData },
      { data: monthlyData },
      { data: historicalData },
      { data: subscriptionsData },
      { data: insurancesData },
      { data: membersData },
      { data: coParentsData },
      { data: creditCardExpensesData },
    ] = await Promise.all([
      supabase.from("households").select("*").eq("id", membership.household_id).single(),
      supabase.from("regular_expenses").select("*").eq("household_id", membership.household_id).eq("is_active", true).order("sort_order"),
      supabase.from("monthly_expenses").select("*").eq("household_id", membership.household_id).gte("month_end", format(monthStart, "yyyy-MM-dd")).lte("month_start", format(monthEnd, "yyyy-MM-dd")),
      supabase.from("monthly_expenses").select("*").eq("household_id", membership.household_id).lt("month_start", format(monthStart, "yyyy-MM-dd")),
      supabase.from("subscriptions").select("*").eq("household_id", membership.household_id).eq("is_active", true),
      supabase.from("insurances").select("*").eq("household_id", membership.household_id).eq("is_active", true),
      supabase.from("household_members").select("*, profiles(full_name, email, avatar_url)").eq("household_id", membership.household_id),
      supabase.from("co_parents").select("*").eq("household_id", membership.household_id),
      supabase.from("credit_card_expenses").select("*, credit_cards(name)").eq("household_id", membership.household_id).gte("month_end", format(monthStart, "yyyy-MM-dd")).lte("month_start", format(monthEnd, "yyyy-MM-dd")),
    ]);

    setHousehold(householdInfo);
    setExpenseCategories(categoriesData || []);
    setMonthlyExpenses(monthlyData || []);
    setSubscriptions(subscriptionsData || []);
    setInsurances(insurancesData || []);
    setMembers(membersData || []);
    setCoParents(coParentsData || []);
    setCreditCardExpenses(creditCardExpensesData || []);

    // Check if there are saved expenses to determine button state
    if ((monthlyData || []).length > 0) {
      setHasSaved(true);
      // Get the most recent updated_at timestamp
      const mostRecent = (monthlyData || []).reduce((latest: any, current: any) => {
        return new Date(current.updated_at) > new Date(latest.updated_at) ? current : latest;
      });
      setLastSavedTime(new Date(mostRecent.updated_at));
    }

    const initialAmounts: Record<string, string> = {};
    (categoriesData || []).forEach((category: any) => {
      const existing = (monthlyData || []).find((m: any) => m.expense_category_id === category.id);

      // For static expenses, always use the current default amount from the category definition
      // This ensures that if the user updates the static amount in settings, it reflects immediately
      if (category.type === "static") {
        initialAmounts[category.id] = category.default_amount.toString();
      } else if (existing) {
        initialAmounts[category.id] = existing.amount.toString();
      } else if (category.type === "dynamic") {
        const previousExpenses = (historicalData || []).filter((h: any) => h.expense_category_id === category.id);
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
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleSave = async () => {
    if (!household || !user) return;
    setSaving(true);

    const entries = expenseCategories.map((category) => ({
      expense_category_id: category.id,
      household_id: household.id,
      month: currentMonth,
      month_start: format(monthStart, "yyyy-MM-dd"),
      month_end: format(monthEnd, "yyyy-MM-dd"),
      amount: parseFloat(amounts[category.id] || "0"),
      created_by: user.id,
    }));

    const { error } = await supabase
      .from("monthly_expenses")
      .upsert(entries as any, { onConflict: "expense_category_id,month" });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save expenses",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Monthly expenses saved",
      });
      setHasSaved(true);
      setLastSavedTime(new Date());
      fetchData();
    }
    setSaving(false);
  };

  const subscriptionsTotal = subscriptions.reduce((sum, sub) => {
    const amount = parseFloat(sub.amount);

    // Always include monthly
    if (sub.billing_cycle === "monthly") return sum + amount;

    // For yearly, only include if billing date is within current financial month
    if (sub.billing_cycle === "yearly") {
      if (!sub.billing_month || !sub.billing_day) return sum + amount; // Fallback

      // Check if the billing date falls within the current financial month range
      // We check both the start year and end year of the range to handle year transitions
      const dateInStartYear = new Date(monthStart.getFullYear(), sub.billing_month - 1, sub.billing_day);
      const dateInEndYear = new Date(monthEnd.getFullYear(), sub.billing_month - 1, sub.billing_day);

      const isDue = (dateInStartYear >= monthStart && dateInStartYear <= monthEnd) ||
        (dateInEndYear >= monthStart && dateInEndYear <= monthEnd);

      return isDue ? sum + amount : sum;
    }

    // Default for quarterly or others (include for now as requested)
    return sum + amount;
  }, 0);

  // Calculate subscription severity
  const subscriptionSeverity = subscriptions.reduce((severity, sub) => {
    if (severity === 'danger') return 'danger'; // Already max severity

    // Check for yearly subscriptions due this month
    if (sub.billing_cycle === 'yearly') {
      if (!sub.billing_month || !sub.billing_day) return severity;

      const dateInStartYear = new Date(monthStart.getFullYear(), sub.billing_month - 1, sub.billing_day);
      const dateInEndYear = new Date(monthEnd.getFullYear(), sub.billing_month - 1, sub.billing_day);

      const isDue = (dateInStartYear >= monthStart && dateInStartYear <= monthEnd) ||
        (dateInEndYear >= monthStart && dateInEndYear <= monthEnd);

      if (isDue) return 'danger';
    }

    // Check for quarterly subscriptions due this month (if not already danger)
    if (sub.billing_cycle === 'quarterly' && severity !== 'danger') {
      if (!sub.billing_month || !sub.billing_day) return 'warning'; // Fallback if no dates

      // Check if the billing date falls within the current financial month range
      // We check for the billing month and 3, 6, 9 months after
      const billingMonths = [
        sub.billing_month - 1,
        (sub.billing_month - 1 + 3) % 12,
        (sub.billing_month - 1 + 6) % 12,
        (sub.billing_month - 1 + 9) % 12
      ];

      const isDue = billingMonths.some(monthIndex => {
        // We check both the start year and end year of the range to handle year transitions
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
      else monthlyAmount = ins.total_amount; // monthly

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expense Management</h1>
          <p className="text-muted-foreground mt-2">
            {formatFinancialMonth(currentMonth)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Expenses</p>
          <p className="text-3xl font-bold text-destructive">
            {totalExpenses.toFixed(0)} {household?.currency || "SEK"}
          </p>
        </div>
      </div>

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
            saving={saving}
            subscriptionsTotal={subscriptionsTotal}
            insuranceTotal={insuranceTotal}
            subscriptionSeverity={subscriptionSeverity}
            members={members}
            coParents={coParents}
            onAmountsChange={setAmounts}
            onSave={handleSave}
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
