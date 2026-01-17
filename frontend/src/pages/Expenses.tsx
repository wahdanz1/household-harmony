import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddButton } from "@/components/ui/add-button";
import { CalendarDays, CreditCard, Users, Moon, Repeat, Shield } from "lucide-react";
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
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
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

  // Keep these for display purposes only
  const currentMonth = getCurrentFinancialMonth(financialMonthStart);
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
    ] = await Promise.all([
      supabase.from("expenses").select("*").eq("household_id", household.id).eq("is_active", true).order("sort_order"),
      supabase.from("monthly_expenses").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
      supabase.from("monthly_expenses").select("*").eq("household_id", household.id).lt("month_start", startStr),
      supabase.from("subscriptions").select("*").eq("household_id", household.id),
      supabase.from("insurances").select("*").eq("household_id", household.id),
    ]);

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

    // Auto-create monthly_expenses records for categories that don't have them yet
    // This ensures Dashboard shows all expenses, not just edited categories
    const missingRecords: any[] = [];
    decryptedCategories.forEach((category: any) => {
      const existing = decryptedMonthly.find((m: any) => m.expense_id === category.id);

      if (!existing && user) {
        // Calculate the appropriate amount for the missing record
        let amount = category.default_amount;

        if (category.type === "dynamic") {
          // Use historical average if available
          const previousExpenses = decryptedHistorical.filter((h: any) => h.expense_id === category.id);
          if (previousExpenses.length > 0) {
            const total = previousExpenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);
            amount = Math.round(total / previousExpenses.length);
          }
        }

        missingRecords.push({
          expense_id: category.id,
          household_id: household.id,
          month: fetchMonth,
          month_start: startStr,
          month_end: endStr,
          amount: parseFloat(amount?.toString() || "0"),
          created_by: user.id,
        });
      }
    });

    // Create missing records in batch if any (encrypted)
    if (missingRecords.length > 0) {
      const encryptedRecords = await Promise.all(
        missingRecords.map(record => encryptExpense(record))
      );
      await supabase.from("monthly_expenses").insert(encryptedRecords);
    }

    // Note: Don't set 'saved' status on initial load - only after actual user edits

    const initialAmounts: Record<string, string> = {};
    decryptedCategories.forEach((category: any) => {
      const existing = decryptedMonthly.find((m: any) => m.expense_id === category.id);

      // For static expenses, always use the current default amount from the category definition
      if (category.type === "static") {
        initialAmounts[category.id] = (category.default_amount || "0").toString();
      } else if (existing) {
        initialAmounts[category.id] = (existing.amount || "0").toString();
      } else if (category.type === "dynamic") {
        const previousExpenses = decryptedHistorical.filter((h: any) => h.expense_id === category.id);
        if (previousExpenses.length > 0) {
          const total = previousExpenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);
          const avg = total / previousExpenses.length;
          initialAmounts[category.id] = Math.round(avg).toString();
        } else {
          initialAmounts[category.id] = (category.default_amount || "0").toString();
        }
      } else {
        initialAmounts[category.id] = (category.default_amount || "0").toString();
      }
    });

    setAmounts(initialAmounts);
    amountsRef.current = initialAmounts; // Sync ref with initial amounts
    setLoading(false);
  }, [user, household, isUnlocked]);

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
    const saveMonth = getCurrentFinancialMonth(fms);
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
      />

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
            <AddButton onClick={() => setAddExpenseDialogOpen(true)}>Add Expense</AddButton>
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
            onAmountChange={handleAmountChange}
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
