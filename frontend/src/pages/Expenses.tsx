import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, Moon, Repeat, Shield, ClipboardCheck, Check, Plus, Zap } from "lucide-react";
import { Alert, AlertContent, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { MonthPickerPopover } from "@/components/shared/MonthPickerPopover";
import { Money, fmtKr } from "@/components/ui/money";
import { CatIcon } from "@/components/ui/cat-icon";
import { AllTabBlockView } from "@/components/expenses/AllTabBlockView";
import { EmptyStateCard } from "@/components/shared/EmptyStateCard";
import { Card } from "@/components/ui/card";
import { Home } from "lucide-react";
import { SharedExpensesTab } from "@/components/expenses/SharedExpensesTab";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { SubscriptionFormDialog } from "@/components/expenses/SubscriptionFormDialog";
import { InsuranceFormDialog } from "@/components/expenses/InsuranceFormDialog";
import { TemporaryExpenseFormDialog } from "@/components/expenses/TemporaryExpenseFormDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
import { reportSuccess, reportFailure, isDown } from "@/utils/outageMonitor";
import { useMonthlyReviewStatus } from "@/components/overview/MonthlyReviewWizard";
import { useEncryptedFields, expenseFields, monthlyExpenseFields, subscriptionFields, insuranceFields } from "@/hooks/useEncryptedFields";
import { subscriptionCategories } from "@/constants/subscriptionCategories";
import { insuranceTypes } from "@/constants/insuranceTypes";
import { VaultLockedAlert } from "@/components/shared/VaultLockedAlert";
import { useEncryption } from "@/contexts/EncryptionContext";
import { ExpensesPageSkeleton } from "@/components/shared/skeletons/PageSkeletons";
import { AvatarTrigger } from "@/components/shared/AvatarTrigger";
import { UserMenu } from "@/components/shared/UserMenu";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileBottomBar, mobileBottomBarSpacer } from "@/components/shared/MobileBottomBar";
import { useHouseholdSubjects } from "@/hooks/useHouseholdSubjects";

const Expenses = () => {
  const { user } = useAuth();
  const { household, members, coParents, dataVersion } = useHousehold();
  const { isUnlocked } = useEncryption();
  const [subjectsRefreshKey, setSubjectsRefreshKey] = useState(0);
  const subjects = useHouseholdSubjects(household?.id, subjectsRefreshKey);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [insurances, setInsurances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [addingExpense, setAddingExpense] = useState(false);
  const [addTemporaryDialogOpen, setAddTemporaryDialogOpen] = useState(false);
  const [addSubscriptionOpen, setAddSubscriptionOpen] = useState(false);
  const [addInsuranceOpen, setAddInsuranceOpen] = useState(false);

  const [editingSubscription, setEditingSubscription] = useState<any | null>(null);
  const [editingInsurance, setEditingInsurance] = useState<any | null>(null);

  const financialMonthStart = household?.financial_month_start || 25;

  // Month navigation state
  const todayMonth = getCurrentFinancialMonth(financialMonthStart);
  const [selectedMonth, setSelectedMonth] = useState(todayMonth);
  const isCurrentMonth = selectedMonth === todayMonth;

  // The review gate only applies once a previous financial month exists with
  // data — fresh households on their very first month aren't asked to review
  // anything yet.
  const { needsReview, latestFinalizedMonth } = useMonthlyReviewStatus(household?.id, financialMonthStart);
  const [hasPriorMonthData, setHasPriorMonthData] = useState(false);
  useEffect(() => {
    if (!household?.id) return;
    supabase
      .from("monthly_expenses")
      .select("id", { count: "exact", head: true })
      .eq("household_id", household.id)
      .lt("month", todayMonth)
      .then(({ count }) => setHasPriorMonthData((count ?? 0) > 0));
  }, [household?.id, todayMonth]);
  const isReadOnly = isCurrentMonth && needsReview && hasPriorMonthData;
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

    // Forms may have created new subjects inline (SubjectPicker "+"); re-fetch them.
    setSubjectsRefreshKey(k => k + 1);

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
        supabase.from("expenses").select("*").eq("household_id", household.id).eq("is_active", true).is("archived_at", null).order("sort_order"),
        supabase.from("monthly_expenses").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
        supabase.from("subscriptions").select("*").eq("household_id", household.id).is("archived_at", null),
        supabase.from("insurances").select("*").eq("household_id", household.id).is("archived_at", null),
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
      { data: subscriptionsData },
      { data: insurancesData },
    ] = results;

    // Decrypt sensitive fields (if encrypted)
    const decryptedCategories = await decryptExpenses(categoriesData || []);
    const decryptedMonthly = await decryptMonthlyExpenses(monthlyData || []);
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

    // Only seed missing rows for the current financial month. Past months
    // stay read-only — viewing them shouldn't silently write rows.
    const missingRecords: any[] = [];
    const isCurrentMonth = fetchMonth === todayMonth;
    if (isCurrentMonth) {
      missingCategories.forEach((category: any) => {
        if (!user) return;
        missingRecords.push({
          expense_id: category.id,
          household_id: household.id,
          month: fetchMonth,
          month_start: startStr,
          month_end: endStr,
          budget_snapshot: parseFloat((category.budget || "0").toString()),
          created_by: user.id,
        });
      });

      if (missingRecords.length > 0) {
        const encryptedRecords = await Promise.all(
          missingRecords.map(record => encryptExpense(record))
        );
        await supabase.from("monthly_expenses").upsert(encryptedRecords, {
          onConflict: "expense_id,month",
          ignoreDuplicates: true,
        });
      }
    }

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, household?.id, household?.financial_month_start, selectedMonth, isUnlocked, dataVersion]);

  useEffect(() => {
    if (household?.id) {
      fetchData();
    }
  }, [household?.id, fetchData]);

  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const handleEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setEditDialogOpen(true);
  };

  // Amortized monthly contribution per subscription:
  //   monthly       → full amount
  //   quarterly     → amount / 3
  //   semi_annually → amount / 6
  //   yearly        → amount / 12
  // Steady run-rate semantics so totals don't swing month-to-month based on
  // when bills happen to land. The Subscriptions section severity below
  // surfaces the actual "due this month" warning separately.
  const subscriptionsTotal = subscriptions
    .filter(sub => sub.is_active)
    .reduce((sum, sub) => {
      const amount = parseFloat(sub.budget);
      if (sub.billing_cycle === "yearly") return sum + amount / 12;
      if (sub.billing_cycle === "semi_annually") return sum + amount / 6;
      if (sub.billing_cycle === "quarterly") return sum + amount / 3;
      return sum + amount;
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
      if (ins.billing_cycle === "yearly") monthlyAmount = ins.budget / 12;
      else if (ins.billing_cycle === "semi_annually") monthlyAmount = ins.budget / 6;
      else if (ins.billing_cycle === "quarterly") monthlyAmount = ins.budget / 3;
      else monthlyAmount = ins.budget;

      if (ins.is_shared) {
        monthlyAmount = monthlyAmount * (ins.share_percentage / 100);
      }
      return sum + monthlyAmount;
    }, 0);

  const expensesBudgetTotal = expenseCategories.reduce(
    (sum, cat) => sum + parseFloat(cat.budget || "0"),
    0
  );
  const totalExpenses = expensesBudgetTotal + subscriptionsTotal + insuranceTotal;

  // Header — month nav hidden when there's no data to navigate (locked state).
  const renderHeader = (showMonthNav: boolean, isLoading = false) => (
    <div className="flex items-center justify-between gap-4 min-h-9">
      <h1>Expenses</h1>
      <div className="flex items-center gap-2">
        {isLoading ? (
          <Skeleton className="h-9 w-32 rounded-full" />
        ) : (
          <div className={showMonthNav ? '' : 'invisible'}>
            <MonthPickerPopover
              selectedMonth={selectedMonth}
              financialMonthStart={financialMonthStart}
              onSelect={setSelectedMonth}
            />
          </div>
        )}
        <div className="md:hidden">
          <UserMenu trigger={<AvatarTrigger />} />
        </div>
      </div>
    </div>
  );

  const hasAnyCategory = expenseCategories.length > 0 || subscriptions.length > 0 || insurances.length > 0;
  const showCoparentTab = !!household?.enable_shared_expenses || coParents.length > 0;
  const showTabsList = showCoparentTab;

  if (loading) {
    return (
      <div className="space-y-5">
        {renderHeader(false, true)}
        <ExpensesPageSkeleton />
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="space-y-5">
        {renderHeader(false)}
        <VaultLockedAlert />
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${mobileBottomBarSpacer}`}>
      {renderHeader(hasAnyCategory)}

      {hasAnyCategory && (
        <Card>
          <p className="text-xs font-medium text-muted tracking-wide">
            Total expenses per month
          </p>
          <div className="mt-1">
            <Money
              v={totalExpenses}
              currency={household?.currency || "SEK"}
              size="4xl"
              weight={600}
              color="danger"
              className="tracking-tighter"
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            {fmtKr(totalExpenses * 12, household?.currency || "SEK")} per year
          </p>
        </Card>
      )}

      {isReadOnly && hasAnyCategory && (
        <Alert variant="warning">
          <ClipboardCheck />
          <AlertContent>
            <AlertTitle>This month's review hasn't been finalized.</AlertTitle>
            <AlertDescription>
              Edits are locked until the Monthly Review is complete. Use the wizard on the Overview to review and finalize.
            </AlertDescription>
          </AlertContent>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/">Open Review</Link>
          </Button>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {showTabsList && (
          <TabsList>
            <TabsTrigger value="all" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">All</span>
            </TabsTrigger>
            <TabsTrigger value="coparent" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Shared</span>
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="all" className="mt-5 space-y-5">
          {!hasAnyCategory ? (
            <EmptyStateCard
              icon={Home}
              iconClassName="text-accent"
              headline="No expenses yet"
              description="Add rent, utilities, phone plans, and other recurring bills."
              primaryLabel="Add your first expense"
              onPrimary={() => setAddingExpense(true)}
            />
          ) : (
          <>
          <div className="hidden sm:grid grid-cols-2 gap-5">
            <Button
              size="lg"
              disabled={isReadOnly}
              className="w-full justify-center gap-2"
              onClick={() => !isReadOnly && setAddingExpense(true)}
            >
              <Plus className="h-4 w-4" />
              Add expense
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={isReadOnly}
              className="w-full justify-center gap-2"
              onClick={() => !isReadOnly && setAddTemporaryDialogOpen(true)}
            >
              <Zap className="h-4 w-4" />
              One-off
            </Button>
          </div>

          <AllTabBlockView
            expenses={[
              ...expenseCategories.map(cat => {
                const monthly = monthlyExpenses.find((m: any) => m.expense_id === cat.id);
                const rawActual = monthly?.actual_amount;
                const actualAmount = rawActual !== undefined && rawActual !== null
                  ? Number(rawActual)
                  : undefined;
                const subj = subjects.find(s => s.id === cat.subject_id);
                const mem = members.find(m => m.id === cat.member_id);
                return {
                  id: cat.id,
                  name: cat.name,
                  amount: parseFloat(cat.budget || '0'),
                  budget: parseFloat(cat.budget || '0'),
                  actualAmount,
                  category: cat.category,
                  subject: subj ? { name: subj.name, type: subj.type } : undefined,
                  member: mem ? { name: mem.profiles?.full_name ?? "Member" } : undefined,
                  isCredit: !!cat.is_credit,
                };
              }),
              // One-time entries (e.g. from credit-import for un-budgeted
              // categories). Source-less rows live only in the month they were
              // charged; rendered read-only here so the user sees the history.
              ...monthlyExpenses
                .filter((m: any) => m.expense_id == null && m.one_time_name)
                .map((m: any) => {
                  const actualAmount = m.actual_amount != null ? Number(m.actual_amount) : undefined;
                  return {
                    id: `onetime-${m.id}`,
                    name: m.one_time_name as string,
                    amount: actualAmount ?? 0,
                    budget: undefined,
                    actualAmount,
                    category: m.one_time_category as string | undefined,
                    readOnly: true,
                  };
                }),
            ].sort((a, b) => (b.actualAmount ?? b.budget ?? 0) - (a.actualAmount ?? a.budget ?? 0))}
            subscriptions={[...subscriptions].sort((a, b) => parseFloat(String(b.amount)) - parseFloat(String(a.amount))).map(sub => {
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
              const subj = subjects.find(s => s.id === sub.subject_id);
              const mem = members.find(m => m.id === sub.member_id);
              return {
                ...sub,
                name: sub.name || sub.service,
                category: sub.category,
                budget: sub.budget,
                isDue,
                subject: subj ? { name: subj.name, type: subj.type } : undefined,
                member: mem ? { name: mem.profiles?.full_name ?? "Member" } : undefined,
                inactive: sub.is_active === false,
              };
            })}
            insurances={[...insurances].sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0)).map(ins => {
              let monthlyAmount = 0;
              if (ins.billing_cycle === "yearly") monthlyAmount = ins.budget / 12;
              else if (ins.billing_cycle === "semi_annually") monthlyAmount = ins.budget / 6;
              else if (ins.billing_cycle === "quarterly") monthlyAmount = ins.budget / 3;
              else monthlyAmount = ins.budget;

              if (ins.is_shared) {
                monthlyAmount = monthlyAmount * (ins.share_percentage / 100);
              }

              const subj = subjects.find(s => s.id === ins.subject_id);
              const mem = members.find(m => m.id === ins.member_id);
              const rawName = typeof ins.name === "string" ? ins.name.trim() : "";
              const customName = rawName === "NaN" ? "" : rawName;
              const typeLabel = insuranceTypes.find(t => t.value === ins.category)?.label ?? "Insurance";
              const fallbackName = typeLabel;
              return {
                id: ins.id,
                name: customName || fallbackName,
                monthly_cost: monthlyAmount,
                budget: ins.budget,
                billing_cycle: ins.billing_cycle,
                category: ins.category,
                subject: subj ? { name: subj.name, type: subj.type } : undefined,
                member: mem ? { name: mem.profiles?.full_name ?? "Member" } : undefined,
                inactive: ins.is_active === false,
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
            onAddSubscription={() => !isReadOnly && setAddSubscriptionOpen(true)}
            onAddInsurance={() => !isReadOnly && setAddInsuranceOpen(true)}
            onSubscriptionClick={(id) => {
              const subscription = subscriptions.find(s => s.id === id);
              if (subscription) setEditingSubscription(subscription);
            }}
            onInsuranceClick={(id) => {
              const insurance = insurances.find(i => i.id === id);
              if (insurance) setEditingInsurance(insurance);
            }}
          />


          <MobileBottomBar>
            <Button
              size="lg"
              disabled={isReadOnly}
              className="w-full justify-center gap-2"
              onClick={() => !isReadOnly && setAddingExpense(true)}
            >
              <Plus className="h-4 w-4" />
              Add expense
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={isReadOnly}
              className="w-full justify-center gap-2"
              onClick={() => !isReadOnly && setAddTemporaryDialogOpen(true)}
            >
              <Zap className="h-4 w-4" />
              One-off
            </Button>
          </MobileBottomBar>
          </>
          )}
        </TabsContent>

        {showCoparentTab && (
          <TabsContent value="coparent" className="mt-5">
            <SharedExpensesTab
              householdId={household?.id}
              currency={household?.currency || "SEK"}
              monthStart={monthStart}
              monthEnd={monthEnd}
            />
          </TabsContent>
        )}
      </Tabs>

      {household && (
        <TemporaryExpenseFormDialog
          open={addTemporaryDialogOpen}
          onOpenChange={setAddTemporaryDialogOpen}
          householdId={household.id}
          financialMonthStart={financialMonthStart}
          onSuccess={fetchData}
        />
      )}

      {household && (
        <ExpenseFormDialog
          open={addingExpense}
          onOpenChange={setAddingExpense}
          mode="add"
          householdId={household.id}
          financialMonthStart={financialMonthStart}
          onSuccess={fetchData}
        />
      )}

      {household && (
        <ExpenseFormDialog
          open={editDialogOpen}
          onOpenChange={(v) => {
            setEditDialogOpen(v);
            if (!v) setEditingCategory(null);
          }}
          mode="edit"
          householdId={household.id}
          financialMonthStart={financialMonthStart}
          initialValues={editingCategory ? {
            id: editingCategory.id,
            category: editingCategory.category,
            name: editingCategory.name,
            budget: editingCategory.budget,
            is_credit: editingCategory.is_credit,
            attribution: editingCategory.member_id
              ? { kind: "member", id: editingCategory.member_id }
              : editingCategory.subject_id
              ? { kind: "subject", id: editingCategory.subject_id }
              : null,
          } : undefined}
          onSuccess={fetchData}
        />
      )}

      {household && (
        <SubscriptionFormDialog
          open={addSubscriptionOpen}
          mode="add"
          householdId={household.id}
          onOpenChange={setAddSubscriptionOpen}
          onSuccess={fetchData}
        />
      )}

      {household && (
        <SubscriptionFormDialog
          open={!!editingSubscription}
          mode="edit"
          householdId={household.id}
          initialValues={editingSubscription ? {
            id: editingSubscription.id,
            name: editingSubscription.name,
            service: editingSubscription.service,
            amount: editingSubscription.amount,
            billing_cycle: editingSubscription.billing_cycle,
            category: editingSubscription.category,
            notes: editingSubscription.notes,
            is_active: editingSubscription.is_active,
            billing_day: editingSubscription.billing_day,
            billing_month: editingSubscription.billing_month,
            attribution: editingSubscription.member_id
              ? { kind: "member", id: editingSubscription.member_id }
              : editingSubscription.subject_id
              ? { kind: "subject", id: editingSubscription.subject_id }
              : null,
          } : undefined}
          onOpenChange={(open) => !open && setEditingSubscription(null)}
          onSuccess={fetchData}
        />
      )}

      {household && (
        <InsuranceFormDialog
          open={addInsuranceOpen}
          mode="add"
          householdId={household.id}
          onOpenChange={setAddInsuranceOpen}
          onSuccess={fetchData}
        />
      )}

      {household && (
        <InsuranceFormDialog
          open={!!editingInsurance}
          mode="edit"
          householdId={household.id}
          initialValues={editingInsurance ? {
            id: editingInsurance.id,
            name: editingInsurance.name,
            provider: editingInsurance.provider,
            category: editingInsurance.category,
            budget: editingInsurance.budget,
            billing_cycle: editingInsurance.billing_cycle,
            billing_month: editingInsurance.billing_month,
            billing_day: editingInsurance.billing_day,
            notes: editingInsurance.notes,
            is_active: editingInsurance.is_active,
            is_shared: editingInsurance.is_shared,
            co_parent_id: editingInsurance.co_parent_id,
            share_percentage: editingInsurance.share_percentage,
            attribution: editingInsurance.member_id
              ? { kind: "member", id: editingInsurance.member_id }
              : editingInsurance.subject_id
              ? { kind: "subject", id: editingInsurance.subject_id }
              : null,
          } : undefined}
          onOpenChange={(open) => !open && setEditingInsurance(null)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
};

export default Expenses;
