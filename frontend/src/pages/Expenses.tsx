import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CalendarDays, CreditCard, Shield, ShoppingBag, LayoutGrid, List, Home, ShoppingCart, Plus } from "lucide-react";
import { MonthlyExpenses } from "@/components/expenses/MonthlyExpenses";
import { VariableExpenses } from "@/components/expenses/VariableExpenses";
import { AllTabBlockView, AllTabListView } from "@/components/expenses/AllTabBlockView";
import { SubscriptionsTab } from "@/components/expenses/SubscriptionsTab";
import { InsuranceTab } from "@/components/expenses/InsuranceTab";
import { SharedExpensesTab } from "@/components/expenses/SharedExpensesTab";
import { CreditTab } from "@/components/expenses/CreditTab";
import { AddExpenseDialog } from "@/components/expenses/AddExpenseDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";

const Expenses = () => {
  const { user } = useAuth();
  const { household, members, coParents } = useHousehold();
  const location = useLocation(); // Trigger refetch on navigation
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [insurances, setInsurances] = useState<any[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [creditCardExpenses, setCreditCardExpenses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<'blocks' | 'list'>('blocks');
  const [addExpenseDialogOpen, setAddExpenseDialogOpen] = useState(false);

  // Autosave state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const amountsRef = useRef<Record<string, string>>({}); // Track latest amounts for autosave

  const financialMonthStart = household?.financial_month_start || 25;

  // Keep these for display purposes only
  const currentMonth = getCurrentFinancialMonth(financialMonthStart);
  const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth, financialMonthStart);

  const fetchData = useCallback(async () => {
    if (!user || !household) return;

    // Compute dates fresh inside fetchData using current financialMonthStart
    const fms = household?.financial_month_start || 25;
    const fetchMonth = getCurrentFinancialMonth(fms);
    const { start: fetchStart, end: fetchEnd } = getFinancialMonthRange(fetchMonth, fms);
    const startStr = format(fetchStart, "yyyy-MM-dd");
    const endStr = format(fetchEnd, "yyyy-MM-dd");

    const [
      { data: categoriesData },
      { data: monthlyData },
      { data: historicalData },
      { data: subscriptionsData },
      { data: insurancesData },
      { data: creditCardExpensesData },
    ] = await Promise.all([
      supabase.from("regular_expenses").select("*").eq("household_id", household.id).eq("is_active", true).order("sort_order"),
      supabase.from("monthly_expenses").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
      supabase.from("monthly_expenses").select("*").eq("household_id", household.id).lt("month_start", startStr),
      supabase.from("subscriptions").select("*").eq("household_id", household.id).eq("is_active", true),
      supabase.from("insurances").select("*").eq("household_id", household.id).eq("is_active", true),
      supabase.from("credit_card_expenses").select("*, credit_cards(name)").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
    ]);

    setExpenseCategories(categoriesData || []);
    setMonthlyExpenses(monthlyData || []);
    setSubscriptions(subscriptionsData || []);
    setInsurances(insurancesData || []);
    setCreditCardExpenses(creditCardExpensesData || []);

    // Auto-create monthly_expenses records for categories that don't have them yet
    // This ensures Dashboard shows all expenses, not just edited categories
    const missingRecords: any[] = [];
    (categoriesData || []).forEach((category: any) => {
      const existing = (monthlyData || []).find((m: any) => m.regular_expense_id === category.id);

      if (!existing && user) {
        // Calculate the appropriate amount for the missing record
        let amount = category.default_amount;

        if (category.type === "dynamic") {
          // Use historical average if available
          const previousExpenses = (historicalData || []).filter((h: any) => h.regular_expense_id === category.id);
          if (previousExpenses.length > 0) {
            const total = previousExpenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);
            amount = Math.round(total / previousExpenses.length);
          }
        }

        missingRecords.push({
          regular_expense_id: category.id,
          household_id: household.id,
          month: fetchMonth,
          month_start: startStr,
          month_end: endStr,
          amount: parseFloat(amount?.toString() || "0"),
          created_by: user.id,
        });
      }
    });

    // Create missing records in batch if any
    if (missingRecords.length > 0) {
      await supabase.from("monthly_expenses").insert(missingRecords);
    }

    // Check if there are saved expenses to set initial status
    if ((monthlyData || []).length > 0 || missingRecords.length > 0) {
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
    amountsRef.current = initialAmounts; // Sync ref with initial amounts
    setLoading(false);
  }, [user, household]);

  useEffect(() => {
    if (household) {
      fetchData();
    }
  }, [household, fetchData, location.key]); // location.key changes on each navigation

  const handleSave = useCallback(async () => {
    if (!household || !user) return;
    setAutoSaveStatus('saving');

    // Use amountsRef to get the latest amounts value
    const currentAmounts = amountsRef.current;

    // Compute dates fresh at save time
    const fms = household?.financial_month_start || 25;
    const saveMonth = getCurrentFinancialMonth(fms);
    const { start: saveStart, end: saveEnd } = getFinancialMonthRange(saveMonth, fms);

    const entries = expenseCategories.map((category) => ({
      regular_expense_id: category.id,
      household_id: household.id,
      month: saveMonth,
      month_start: format(saveStart, "yyyy-MM-dd"),
      month_end: format(saveEnd, "yyyy-MM-dd"),
      amount: parseFloat(currentAmounts[category.id] || "0"),
      created_by: user.id,
    }));

    const { error } = await supabase
      .from("monthly_expenses")
      .upsert(entries as any, { onConflict: "regular_expense_id,month" });

    if (error) {
      setAutoSaveStatus('error');
    } else {
      setAutoSaveStatus('saved');
      // Update monthlyExpenses state without refetching (which would overwrite amounts)
      setMonthlyExpenses(entries.map((entry, i) => ({
        ...entry,
        id: monthlyExpenses.find(m => m.regular_expense_id === entry.regular_expense_id)?.id || `temp-${i}`,
        updated_at: new Date().toISOString(),
      })));
    }
  }, [household, user, expenseCategories, monthlyExpenses]);

  // Handle amount change with debounced autosave
  const handleAmountChange = useCallback((categoryId: string, value: string) => {
    setAmounts(prev => {
      const newAmounts = { ...prev, [categoryId]: value };
      amountsRef.current = newAmounts; // Keep ref in sync for autosave
      return newAmounts;
    });
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
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${household?.enable_credit_cards ? (coParents.length > 0 ? 7 : 6) : (coParents.length > 0 ? 6 : 5)}, minmax(0, 1fr))` }}>
          <TabsTrigger value="all" className="flex items-center gap-2 transition-all hover:bg-muted/80">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">All</span>
          </TabsTrigger>
          <TabsTrigger value="fixed" className="flex items-center gap-2 transition-all hover:bg-muted/80">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Fixed</span>
          </TabsTrigger>
          <TabsTrigger value="variable" className="flex items-center gap-2 transition-all hover:bg-muted/80">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Variable</span>
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex items-center gap-2 transition-all hover:bg-muted/80">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Subscriptions</span>
          </TabsTrigger>
          <TabsTrigger value="insurance" className="flex items-center gap-2 transition-all hover:bg-muted/80">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Insurance</span>
          </TabsTrigger>
          {household?.enable_credit_cards && (
            <TabsTrigger value="credit" className="flex items-center gap-2 transition-all hover:bg-muted/80">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Credit</span>
            </TabsTrigger>
          )}
          {coParents.length > 0 && (
            <TabsTrigger value="shared" className="flex items-center gap-2 transition-all hover:bg-muted/80">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Shared</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all" className="mt-6 space-y-4">
          {/* Header with Add Button and View Mode Toggle */}
          <div className="flex justify-between items-center">
            <Button onClick={() => setAddExpenseDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
            <div className="flex rounded-lg border border-border p-1 bg-muted/30">
              <Button
                variant={viewMode === 'blocks' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3"
                onClick={() => setViewMode('blocks')}
              >
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                Blocks
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4 mr-1.5" />
                List
              </Button>
            </div>
          </div>

          {/* Conditional View */}
          {viewMode === 'blocks' ? (
            <AllTabBlockView
              fixedExpenses={expenseCategories
                .filter(cat => {
                  const fixedCategories = ['rent', 'electricity', 'internet', 'phone', 'transportation'];
                  return cat.type === 'static' || fixedCategories.includes(cat.category);
                })
                .map(cat => ({
                  id: cat.id,
                  name: cat.name,
                  amount: parseFloat(amounts[cat.id] || cat.default_amount || '0'),
                  category: cat.category,
                }))}
              variableExpenses={expenseCategories
                .filter(cat => {
                  const fixedCategories = ['rent', 'electricity', 'internet', 'phone', 'transportation'];
                  return cat.type !== 'static' && !fixedCategories.includes(cat.category);
                })
                .map(cat => ({
                  id: cat.id,
                  name: cat.name,
                  amount: parseFloat(amounts[cat.id] || cat.default_amount || '0'),
                  category: cat.category,
                }))}
              subscriptions={subscriptions.filter(s => s.is_active)}
              insurances={insurances.filter(i => i.is_active)}
              subscriptionsTotal={subscriptionsTotal}
              insuranceTotal={insuranceTotal}
              currency={household?.currency || "SEK"}
              onNavigateToFixed={() => setActiveTab("fixed")}
              onNavigateToSubscriptions={() => setActiveTab("subscriptions")}
              onNavigateToInsurance={() => setActiveTab("insurance")}
            />
          ) : (
            <AllTabListView
              expenses={expenseCategories.map(cat => ({
                id: cat.id,
                name: cat.name,
                amount: parseFloat(amounts[cat.id] || cat.default_amount || '0'),
                category: cat.category,
              }))}
              subscriptions={subscriptions.filter(s => s.is_active)}
              insurances={insurances.filter(i => i.is_active)}
              currency={household?.currency || "SEK"}
              onItemClick={(id, type) => {
                if (type === 'subscription') setActiveTab("subscriptions");
                else if (type === 'insurance') setActiveTab("insurance");
                else setActiveTab("fixed");
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="fixed" className="mt-6">
          <MonthlyExpenses
            householdId={household?.id}
            expenseCategories={expenseCategories.filter(cat => {
              // Filter for predictable/fixed expenses
              // Include: static types + specific categories like rent, electricity, internet, phone
              const fixedCategories = ['rent', 'electricity', 'internet', 'phone', 'transportation'];
              return cat.type === 'static' || fixedCategories.includes(cat.category);
            })}
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

        <TabsContent value="variable" className="mt-6">
          <VariableExpenses
            householdId={household?.id}
            expenseCategories={expenseCategories.filter(cat => {
              // Filter for variable/budgeted expenses (opposite of fixed)
              const fixedCategories = ['rent', 'electricity', 'internet', 'phone', 'transportation'];
              return cat.type !== 'static' && !fixedCategories.includes(cat.category);
            })}
            monthlyExpenses={monthlyExpenses}
            amounts={amounts}
            currency={household?.currency || "SEK"}
            hasCoParents={coParents.length > 0}
            autoSaveStatus={autoSaveStatus}
            onAmountChange={handleAmountChange}
            onCategoriesUpdate={fetchData}
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

      {/* Add Expense Dialog */}
      <AddExpenseDialog
        open={addExpenseDialogOpen}
        onOpenChange={setAddExpenseDialogOpen}
        householdId={household?.id || ""}
        hasCoParents={coParents.length > 0}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default Expenses;
