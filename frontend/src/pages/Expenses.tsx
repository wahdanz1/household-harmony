import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddButton } from "@/components/ui/add-button";
import { Button } from "@/components/ui/button";
import { CalendarDays, CreditCard, Users, Moon, Repeat, Shield, ClipboardCheck } from "lucide-react";
import { AllTabBlockView } from "@/components/expenses/AllTabBlockView";
import { SharedExpensesTab } from "@/components/expenses/SharedExpensesTab";
import { CreditTab } from "@/components/expenses/CreditTab";
import { AddExpenseDialog } from "@/components/expenses/AddExpenseDialog";
import { EditExpenseDialog } from "@/components/expenses/EditExpenseDialog";
import { EditSubscriptionDialog } from "@/components/expenses/EditSubscriptionDialog";
import { EditInsuranceDialog } from "@/components/expenses/EditInsuranceDialog";
import { useExpenses } from "@/components/expenses/hooks/useExpenses";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { getCurrentFinancialMonth, getFinancialMonthRange, getPreviousFinancialMonth, getNextFinancialMonth } from "@/utils/dateUtils";
import { fetchMostRecentByKey } from "@/utils/carryForward";
import { reportSuccess, reportFailure, isDown } from "@/utils/outageMonitor";
import { useMonthlyReviewStatus } from "@/components/dashboard/MonthlyReviewWizard";
import { useEncryptedFields, expenseFields, monthlyExpenseFields, subscriptionFields, insuranceFields } from "@/hooks/useEncryptedFields";
import { subscriptionCategories } from "@/constants/subscriptionCategories";
import { insuranceTypes } from "@/constants/insuranceTypes";
import { VaultLockedAlert } from "@/components/shared/VaultLockedAlert";
import { useEncryption } from "@/contexts/EncryptionContext";
import { LoadingState } from "@/components/shared/states";

const Expenses = () => {
  const { user } = useAuth();
  const { household, members, coParents } = useHousehold();
  const { isUnlocked } = useEncryption();
  const location = useLocation(); // Trigger refetch on navigation
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [insurances, setInsurances] = useState<any[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  // Credit card expenses now handled via expenses table with is_credit=true
  const [activeTab, setActiveTab] = useState("all");
  const [addExpenseDialogOpen, setAddExpenseDialogOpen] = useState(false);

  // Edit dialog state for subscriptions and insurance
  const [editingSubscription, setEditingSubscription] = useState<any | null>(null);
  const [editingInsurance, setEditingInsurance] = useState<any | null>(null);

  // Autosave state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const amountsRef = useRef<Record<string, string>>({}); // Track latest amounts for autosave

  const financialMonthStart = household?.financial_month_start || 25;

  // Month navigation state
  const todayMonth = getCurrentFinancialMonth(financialMonthStart);
  const [selectedMonth, setSelectedMonth] = useState(todayMonth);
  const isCurrentMonth = selectedMonth === todayMonth;

  // Monthly review gate
  const { needsReview, latestFinalizedMonth } = useMonthlyReviewStatus(household?.id, financialMonthStart);
  const isReadOnly = isCurrentMonth && needsReview;
  const initialDefaultRef = useRef(false);
  useEffect(() => {
    if (initialDefaultRef.current) return;
    if (needsReview && latestFinalizedMonth && selectedMonth === todayMonth) {
      setSelectedMonth(latestFinalizedMonth);
    }
    initialDefaultRef.current = true;
  }, [needsReview, latestFinalizedMonth, selectedMonth, todayMonth]);

  const currentMonth = selectedMonth;
  const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth, financialMonthStart);

  // Encryption hooks for expense data
  const { decryptRecords: decryptExpenses } = useEncryptedFields(expenseFields);
  const { decryptRecords: decryptMonthlyExpenses, encryptRecord: encryptExpense } = useEncryptedFields(monthlyExpenseFields);
  const { decryptRecords: decryptSubscriptions } = useEncryptedFields(subscriptionFields);
  const { decryptRecords: decryptInsurances } = useEncryptedFields(insuranceFields);

  const fetchData = useCallback(async () => {
    if (!user || !household) return;

    // If vault is locked, we can't fetch decrypted data safely
    if (!isUnlocked) {
      setLoading(false);
      return;
    }

    // Skip fetch entirely while the outage monitor is tripped.
    if (isDown()) {
      setLoading(false);
      return;
    }

    // Use the selected month (navigable)
    const fms = household?.financial_month_start || 25;
    const fetchMonth = selectedMonth;
    const { start: fetchStart, end: fetchEnd } = getFinancialMonthRange(fetchMonth, fms);
    const startStr = format(fetchStart, "yyyy-MM-dd");
    const endStr = format(fetchEnd, "yyyy-MM-dd");

    let results;
    try {
      results = await Promise.all([
        supabase.from("expenses").select("*").eq("household_id", household.id).eq("is_active", true).order("sort_order"),
        supabase.from("monthly_expenses").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
        supabase.from("monthly_expenses").select("*").eq("household_id", household.id).lt("month_start", startStr),
        supabase.from("subscriptions").select("*").eq("household_id", household.id),
        supabase.from("insurances").select("*").eq("household_id", household.id),
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
      { data: categoriesData },
      { data: monthlyData },
      { data: historicalData },
      { data: subscriptionsData },
      { data: insurancesData },
    ] = results;

    // Decrypt sensitive fields (if encrypted)
    const decryptedCategories = await decryptExpenses(categoriesData || []);
    const decryptedMonthly = await decryptMonthlyExpenses(monthlyData || []);
    const decryptedHistorical = await decryptMonthlyExpenses(historicalData || []);
    const decryptedSubs = await decryptSubscriptions(subscriptionsData || []);
    const decryptedIns = await decryptInsurances(insurancesData || []);

    setExpenseCategories(decryptedCategories);
    setMonthlyExpenses(decryptedMonthly);
    setSubscriptions(decryptedSubs);
    setInsurances(decryptedIns);
    // Credit card expenses now tracked via expenses.is_credit

    // Carry-forward: find most recent record per category (from any month before this one)
    const missingCategories = decryptedCategories.filter((cat: any) =>
      !decryptedMonthly.find((m: any) => m.expense_id === cat.id)
    );

    const mostRecentByCategory = await fetchMostRecentByKey({
      table: "monthly_expenses",
      keyField: "expense_id",
      keys: missingCategories.map((c: any) => c.id),
      householdId: household.id,
      beforeMonth: fetchMonth,
      decrypt: decryptMonthlyExpenses,
    });

    // Auto-create monthly_expenses records for categories that don't have them yet
    // Carry forward from most recent actual values, fall back to default
    const missingRecords: any[] = [];
    missingCategories.forEach((category: any) => {
      if (!user) return;
      const prevRecord = mostRecentByCategory.get(category.id);
      const amount = prevRecord
        ? parseFloat((prevRecord.amount || "0").toString())
        : parseFloat((category.default_amount || "0").toString());
      missingRecords.push({
        expense_id: category.id,
        household_id: household.id,
        month: fetchMonth,
        month_start: startStr,
        month_end: endStr,
        amount,
        created_by: user.id,
      });
    });

    // Create missing records in batch if any (encrypted)
    if (missingRecords.length > 0) {
      const encryptedRecords = await Promise.all(
        missingRecords.map(record => encryptExpense(record))
      );
      // Use upsert with ignoreDuplicates so concurrent fetchData runs (e.g.
      // React strict-mode double effects, or rapid navigation) don't 409.
      await supabase.from("monthly_expenses").upsert(encryptedRecords, {
        onConflict: "expense_id,month",
        ignoreDuplicates: true,
      });
    }

    // Note: Don't set 'saved' status on initial load - only after actual user edits

    const initialAmounts: Record<string, string> = {};
    decryptedCategories.forEach((category: any) => {
      const existing = decryptedMonthly.find((m: any) => m.expense_id === category.id);
      if (existing) {
        initialAmounts[category.id] = (existing.amount || "0").toString();
      } else {
        const missing = missingRecords.find((r: any) => r.expense_id === category.id);
        initialAmounts[category.id] = missing ? missing.amount.toString() : (category.default_amount || "0").toString();
      }
    });

    setAmounts(initialAmounts);
    amountsRef.current = initialAmounts; // Sync ref with initial amounts
    setLoading(false);
  }, [user, household, selectedMonth, isUnlocked]);

  useEffect(() => {
    if (household) {
      fetchData();
    }
  }, [household, fetchData, location.key]); // location.key changes on each navigation

  // Expense editing hook (for inline editing)
  const {
    categoryDialogOpen,
    setCategoryDialogOpen,
    editingCategoryId,
    categoryFormData,
    setCategoryFormData,
    handleEditCategory,
    handleSaveCategory,
    handleDeleteCategory,
  } = useExpenses(household?.id || "", expenseCategories, fetchData);

  const handleSave = useCallback(async () => {
    if (!household || !user) return;
    setAutoSaveStatus('saving');

    // Use amountsRef to get the latest amounts value
    const currentAmounts = amountsRef.current;

    // Compute dates fresh at save time
    const fms = household?.financial_month_start || 25;
    const saveMonth = selectedMonth;
    const { start: saveStart, end: saveEnd } = getFinancialMonthRange(saveMonth, fms);

    // Build entries and encrypt them
    const entries = await Promise.all(expenseCategories.map(async (category) => {
      const baseEntry = {
        expense_id: category.id,
        household_id: household.id,
        month: saveMonth,
        month_start: format(saveStart, "yyyy-MM-dd"),
        month_end: format(saveEnd, "yyyy-MM-dd"),
        amount: parseFloat(currentAmounts[category.id] || "0"),
        created_by: user.id,
      };
      // Encrypt the entry (encrypts amount field)
      return await encryptExpense(baseEntry);
    }));

    const { error } = await supabase
      .from("monthly_expenses")
      .upsert(entries as any, { onConflict: "expense_id,month" });

    if (error) {
      setAutoSaveStatus('error');
    } else {
      setAutoSaveStatus('saved');
      // Update monthlyExpenses state without refetching (which would overwrite amounts)
      setMonthlyExpenses(entries.map((entry, i) => ({
        ...entry,
        id: monthlyExpenses.find(m => m.expense_id === entry.expense_id)?.id || `temp-${i}`,
        updated_at: new Date().toISOString(),
      })));
    }
  }, [household, user, expenseCategories, monthlyExpenses, encryptExpense]);

  // Handle amount change with debounced autosave
  const handleAmountChange = useCallback((categoryId: string, value: string) => {
    if (isReadOnly) return;
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
  }, [handleSave, isReadOnly]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Calculate this month's subscription cost (not average monthly!)
  // - Monthly: always counts
  // - Quarterly: full amount only if due this month
  // - Yearly: full amount only if due this month
  const subscriptionsTotal = subscriptions.filter(sub => sub.is_active).reduce((sum, sub) => {
    const amount = parseFloat(sub.amount);

    if (sub.billing_cycle === "monthly") return sum + amount;

    if (sub.billing_cycle === "yearly") {
      if (!sub.billing_month || !sub.billing_day) return sum; // No billing date set, don't include
      const dateInStartYear = new Date(monthStart.getFullYear(), sub.billing_month - 1, sub.billing_day);
      const dateInEndYear = new Date(monthEnd.getFullYear(), sub.billing_month - 1, sub.billing_day);
      const isDue = (dateInStartYear >= monthStart && dateInStartYear <= monthEnd) ||
        (dateInEndYear >= monthStart && dateInEndYear <= monthEnd);
      return isDue ? sum + amount : sum;
    }

    if (sub.billing_cycle === "quarterly") {
      if (!sub.billing_month || !sub.billing_day) return sum; // No billing date set, don't include
      const billingMonths = [
        sub.billing_month - 1,
        (sub.billing_month - 1 + 3) % 12,
        (sub.billing_month - 1 + 6) % 12,
        (sub.billing_month - 1 + 9) % 12
      ];
      const isDue = billingMonths.some(monthIndex => {
        const dateInStartYear = new Date(monthStart.getFullYear(), monthIndex, sub.billing_day!);
        const dateInEndYear = new Date(monthEnd.getFullYear(), monthIndex, sub.billing_day!);
        return (dateInStartYear >= monthStart && dateInStartYear <= monthEnd) ||
          (dateInEndYear >= monthStart && dateInEndYear <= monthEnd);
      });
      return isDue ? sum + amount : sum;
    }

    return sum;
  }, 0);

  // Calculate next month's start/end for "upcoming" warning
  const nextMonthStart = new Date(monthEnd);
  nextMonthStart.setDate(nextMonthStart.getDate() + 1);
  const nextMonthEnd = new Date(nextMonthStart);
  nextMonthEnd.setMonth(nextMonthEnd.getMonth() + 1);
  nextMonthEnd.setDate(nextMonthEnd.getDate() - 1);

  const subscriptionSeverity = subscriptions.filter(sub => sub.is_active).reduce((severity, sub) => {
    if (severity === 'danger') return 'danger'; // danger is highest priority

    if (sub.billing_cycle === 'yearly') {
      if (!sub.billing_month || !sub.billing_day) return severity;
      const dateInStartYear = new Date(monthStart.getFullYear(), sub.billing_month - 1, sub.billing_day);
      const dateInEndYear = new Date(monthEnd.getFullYear(), sub.billing_month - 1, sub.billing_day);

      // Check if due THIS month (danger - red)
      const isDueThisMonth = (dateInStartYear >= monthStart && dateInStartYear <= monthEnd) ||
        (dateInEndYear >= monthStart && dateInEndYear <= monthEnd);
      if (isDueThisMonth) return 'danger';

      // Check if due NEXT month (upcoming - orange)
      const isDueNextMonth = (dateInStartYear >= nextMonthStart && dateInStartYear <= nextMonthEnd) ||
        (dateInEndYear >= nextMonthStart && dateInEndYear <= nextMonthEnd);
      if (isDueNextMonth && severity !== 'warning') return 'upcoming';
    }

    if (sub.billing_cycle === 'quarterly' && severity !== 'danger' && severity !== 'upcoming') {
      if (!sub.billing_month || !sub.billing_day) return severity; // No warning without billing info
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
  }, 'default' as 'default' | 'upcoming' | 'warning' | 'danger');

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

  // Credit card expenses now included in regular expenses via is_credit flag
  const totalExpenses = Object.values(amounts).reduce((sum, val) => sum + parseFloat(val || "0"), 0) + subscriptionsTotal + insuranceTotal;

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Expense Management" />
        <LoadingState />
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="space-y-4">
        <PageHeader title="Expense Management" />
        <VaultLockedAlert />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Expense Management"
        totalLabel="Total Expenses"
        totalAmount={totalExpenses}
        totalColorClass="text-destructive"
        month={selectedMonth}
        onPreviousMonth={() => setSelectedMonth(getPreviousFinancialMonth(selectedMonth, financialMonthStart))}
        onNextMonth={() => setSelectedMonth(getNextFinancialMonth(selectedMonth, financialMonthStart))}
        isCurrentMonth={isCurrentMonth}
      />

      {isReadOnly && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <ClipboardCheck className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium">This month's review hasn't been finalized.</p>
            <p className="text-xs text-muted-foreground">
              Edits are locked until the Monthly Review is complete. Use the wizard on the Dashboard to review and finalize.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/">Open Review</Link>
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Only show tabs when there are multiple tabs (Credit or Co-Parent enabled) */}
        {(household?.enable_credit_cards || coParents.length > 0) && (
          <TabsList>
            <TabsTrigger value="all" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">All</span>
            </TabsTrigger>
            {household?.enable_credit_cards && (
              <TabsTrigger value="credit" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Credit</span>
              </TabsTrigger>
            )}
            {coParents.length > 0 && (
              <TabsTrigger value="coparent" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Co-Parent</span>
              </TabsTrigger>
            )}
          </TabsList>
        )}

        <TabsContent value="all" className="mt-6 space-y-4">
          {/* Header with Add Button and Saved indicator */}
          <div className="flex justify-between items-center">
            <AddButton disabled={isReadOnly} onClick={() => !isReadOnly && setAddExpenseDialogOpen(true)}>Add Expense</AddButton>
            {/* Saved indicator - fade in animation matching Income page */}
            {autoSaveStatus === 'saved' && (
              <span className="text-sm text-primary animate-in fade-in duration-150">
                ✓ Saved
              </span>
            )}
            {autoSaveStatus === 'error' && (
              <span className="text-sm text-destructive">
                Failed to save
              </span>
            )}
          </div>

          {/* Expense Blocks View */}
          <AllTabBlockView
            expenses={expenseCategories.map(cat => ({
              id: cat.id,
              name: cat.name,
              amount: parseFloat(amounts[cat.id] || cat.default_amount || '0'),
              defaultAmount: parseFloat(cat.default_amount || '0'),
              category: cat.category,
            })).sort((a, b) => b.amount - a.amount)}
            subscriptions={subscriptions.filter(s => s.is_active).map(sub => {
              // Calculate if this subscription is due in current financial month
              let isDue = false;
              if (sub.billing_cycle === 'yearly' && sub.billing_month && sub.billing_day) {
                const dateInStartYear = new Date(monthStart.getFullYear(), sub.billing_month - 1, sub.billing_day);
                const dateInEndYear = new Date(monthEnd.getFullYear(), sub.billing_month - 1, sub.billing_day);
                isDue = (dateInStartYear >= monthStart && dateInStartYear <= monthEnd) ||
                  (dateInEndYear >= monthStart && dateInEndYear <= monthEnd);
              } else if (sub.billing_cycle === 'quarterly' && sub.billing_month && sub.billing_day) {
                const billingMonths = [
                  sub.billing_month - 1,
                  (sub.billing_month - 1 + 3) % 12,
                  (sub.billing_month - 1 + 6) % 12,
                  (sub.billing_month - 1 + 9) % 12
                ];
                isDue = billingMonths.some(monthIndex => {
                  const dateInStartYear = new Date(monthStart.getFullYear(), monthIndex, sub.billing_day!);
                  const dateInEndYear = new Date(monthEnd.getFullYear(), monthIndex, sub.billing_day!);
                  return (dateInStartYear >= monthStart && dateInStartYear <= monthEnd) ||
                    (dateInEndYear >= monthStart && dateInEndYear <= monthEnd);
                });
              } else if (sub.billing_cycle === 'monthly') {
                isDue = true; // Monthly is always "due"
              }
              return {
                ...sub,
                category: sub.category, // Pass category for icon lookup
                total_amount: sub.amount,
                isDue,
              };
            })}
            insurances={insurances.filter(i => i.is_active).map(ins => {
              // Calculate monthly cost from total_amount and payment_frequency
              let monthlyAmount = 0;
              if (ins.payment_frequency === "yearly") monthlyAmount = ins.total_amount / 12;
              else if (ins.payment_frequency === "semi_annually") monthlyAmount = ins.total_amount / 6;
              else if (ins.payment_frequency === "quarterly") monthlyAmount = ins.total_amount / 3;
              else monthlyAmount = ins.total_amount;

              if (ins.is_shared) {
                monthlyAmount = monthlyAmount * (ins.share_percentage / 100);
              }

              return {
                id: ins.id,
                name: ins.name,
                monthly_cost: monthlyAmount,
                total_amount: ins.total_amount,
                payment_frequency: ins.payment_frequency,
                type: ins.category, // Pass category for icon lookup
              };
            })}
            subscriptionsTotal={subscriptionsTotal}
            insuranceTotal={insuranceTotal}
            subscriptionSeverity={subscriptionSeverity}
            currency={household?.currency || "SEK"}
            onExpenseClick={(id) => {
              const expense = expenseCategories.find(cat => cat.id === id);
              if (expense) handleEditCategory(expense);
            }}
            onSubscriptionClick={(id) => {
              const subscription = subscriptions.find(s => s.id === id);
              if (subscription) setEditingSubscription(subscription);
            }}
            onInsuranceClick={(id) => {
              const insurance = insurances.find(i => i.id === id);
              if (insurance) setEditingInsurance(insurance);
            }}
            onAmountChange={isReadOnly ? undefined : handleAmountChange}
          />

          {/* Inactive Items Section */}
          {(subscriptions.some(s => !s.is_active) || insurances.some(i => !i.is_active)) && (
            <div className="mt-6 pt-4 border-t border-border/50">
              <h3>
                <Moon className="h-4 w-4 opacity-60 inline mr-2" /> Inactive Items
              </h3>
              <div className="space-y-2">
                {subscriptions.filter(s => !s.is_active).map(sub => {
                  const subCat = subscriptionCategories.find(c => c.value === sub.category);
                  const SubIcon = subCat?.icon || Repeat;
                  return (
                    <div
                      key={sub.id}
                      className="list-row-inactive"
                      onClick={() => setEditingSubscription(sub)}
                    >
                      <div className="flex items-center gap-2">
                        <SubIcon className="h-4 w-4" style={{ color: subCat?.color ? `${subCat.color}80` : undefined }} />
                        <span className="text-sm">{sub.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {sub.amount} {household?.currency}/
                        {sub.billing_cycle === 'yearly' ? 'year' : sub.billing_cycle === 'quarterly' ? 'quarter' : 'month'}
                      </span>
                    </div>
                  );
                })}
                {insurances.filter(i => !i.is_active).map(ins => {
                  const insCat = insuranceTypes.find(c => c.value === ins.category);
                  const InsIcon = insCat?.icon || Shield;
                  return (
                    <div
                      key={ins.id}
                      className="list-row-inactive"
                      onClick={() => setEditingInsurance(ins)}
                    >
                      <div className="flex items-center gap-2">
                        <InsIcon className="h-4 w-4" style={{ color: insCat?.color ? `${insCat.color}80` : undefined }} />
                        <span className="text-sm">{ins.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {ins.total_amount} {household?.currency}/{ins.payment_frequency === 'yearly' ? 'year' : 'period'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
          <TabsContent value="coparent" className="mt-6">
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

      {/* Edit Expense Dialog */}
      <EditExpenseDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        editingCategoryId={editingCategoryId}
        categoryFormData={categoryFormData}
        expenseCategories={expenseCategories}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
      />

      {/* Edit Subscription Dialog */}
      <EditSubscriptionDialog
        open={!!editingSubscription}
        subscription={editingSubscription}
        onOpenChange={(open) => !open && setEditingSubscription(null)}
        onSave={fetchData}
      />

      {/* Edit Insurance Dialog */}
      <EditInsuranceDialog
        open={!!editingInsurance}
        insurance={editingInsurance}
        coParents={coParents}
        onOpenChange={(open) => !open && setEditingInsurance(null)}
        onSave={fetchData}
      />
    </div>
  );
};

export default Expenses;
