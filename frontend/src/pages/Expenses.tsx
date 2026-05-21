import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { classifySourcesByFM } from "@/utils/billingEvents";
import { reportSuccess, reportFailure, isDown } from "@/utils/outageMonitor";
import { useMonthlyReviewStatus } from "@/components/overview/MonthlyReviewWizard";
import { useEncryptedFields, expenseFields, monthlyExpenseFields, subscriptionFields, insuranceFields } from "@/hooks/useEncryptedFields";
import { subscriptionCategories } from "@/constants/subscriptionCategories";
import { insuranceTypes } from "@/constants/insuranceTypes";
import { VaultLockedAlert } from "@/components/shared/VaultLockedAlert";
import { PastMonthDetailsDialog, PastMonthDetailsItem } from "@/components/shared/PastMonthDetailsDialog";
import { getCategoryById } from "@/constants/expenseCategories";
import { useEncryption } from "@/contexts/EncryptionContext";
import { ExpensesPageSkeleton } from "@/components/shared/skeletons/PageSkeletons";
import { AvatarTrigger } from "@/components/shared/AvatarTrigger";
import { UserMenu } from "@/components/shared/UserMenu";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileBottomBar, mobileBottomBarSpacer } from "@/components/shared/MobileBottomBar";
import { useHouseholdSubjects } from "@/hooks/useHouseholdSubjects";

const Expenses = () => {
  const { user } = useAuth();
  const { household, members, coParents, loading: householdLoading, dataVersion } = useHousehold();
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
  const [detailsItem, setDetailsItem] = useState<PastMonthDetailsItem | null>(null);

  // ?expand=subscriptions|insurances|expenses picks which All-tab accordion
  // opens on landing. Default is 'expenses'. Navigated from Overview tiles.
  const [searchParams] = useSearchParams();
  const expandParam = searchParams.get("expand");
  const defaultExpanded: 'expenses' | 'subscriptions' | 'insurances' =
    expandParam === 'subscriptions' || expandParam === 'insurances' ? expandParam : 'expenses';

  const financialMonthStart = household?.financial_month_start || 25;

  // Month navigation state
  const todayMonth = getCurrentFinancialMonth(financialMonthStart);
  const [selectedMonth, setSelectedMonth] = useState(todayMonth);
  const isCurrentMonth = selectedMonth === todayMonth;
  const isPastMonth = selectedMonth < todayMonth;

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

    // Past months are historical: include archived/inactive sources so their
    // monthly_* rows still resolve names + amounts.
    const isPastMonth = fetchMonth < todayMonth;

    let expensesQuery = supabase.from("expenses").select("*").eq("household_id", household.id);
    if (!isPastMonth) {
      expensesQuery = expensesQuery.eq("is_active", true).is("archived_at", null);
    }
    expensesQuery = expensesQuery.order("sort_order");

    let subscriptionsQuery = supabase.from("subscriptions").select("*").eq("household_id", household.id);
    if (!isPastMonth) {
      subscriptionsQuery = subscriptionsQuery.is("archived_at", null);
    }

    let insurancesQuery = supabase.from("insurances").select("*").eq("household_id", household.id);
    if (!isPastMonth) {
      insurancesQuery = insurancesQuery.is("archived_at", null);
    }

    let results;
    try {
      results = await Promise.all([
        expensesQuery,
        supabase.from("monthly_expenses").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
        subscriptionsQuery,
        insurancesQuery,
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
    if (householdLoading) return;
    if (!household?.id) {
      // Stranded after leave — surface the empty / locked state below
      // instead of holding the skeleton open.
      setLoading(false);
      return;
    }
    fetchData();
  }, [householdLoading, household?.id, fetchData]);

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

  // Section severity is driven by computed billing schedule (date-math from
  // source.billing_month/day/cycle). A source bills in the selected FM →
  // section "this month"; bills in next FM → "next month". Monthly cycles
  // are routine and don't trigger warnings.
  const { thisFm: subsThisFm, nextFm: subsNextFm } = classifySourcesByFM(
    subscriptions.filter((s: any) => s.is_active),
    currentMonth,
    financialMonthStart,
  );
  const { thisFm: insThisFm, nextFm: insNextFm } = classifySourcesByFM(
    insurances.filter((i: any) => i.is_active),
    currentMonth,
    financialMonthStart,
  );

  type Severity = 'default' | 'upcoming' | 'warning' | 'danger';
  const escalate = (current: Severity, next: Severity): Severity => {
    const rank: Record<Severity, number> = { default: 0, upcoming: 1, warning: 2, danger: 3 };
    return rank[next] > rank[current] ? next : current;
  };

  const subscriptionSeverity: Severity = subscriptions
    .filter(sub => sub.is_active)
    .reduce((sev, sub) => {
      if (sub.billing_cycle === 'monthly') return sev;
      if (subsThisFm.has(sub.id)) {
        return escalate(sev, sub.billing_cycle === 'yearly' ? 'danger' : 'warning');
      }
      if (subsNextFm.has(sub.id)) {
        return escalate(sev, 'upcoming');
      }
      return sev;
    }, 'default' as Severity);

  const insuranceSeverity: Severity = insurances
    .filter((ins: any) => ins.is_active)
    .reduce((sev, ins: any) => {
      if (ins.billing_cycle === 'monthly') return sev;
      if (insThisFm.has(ins.id)) {
        return escalate(sev, ins.billing_cycle === 'yearly' ? 'danger' : 'warning');
      }
      if (insNextFm.has(ins.id)) {
        return escalate(sev, 'upcoming');
      }
      return sev;
    }, 'default' as Severity);

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
          {!isPastMonth && (
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
          )}

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
                  previousBudgetSnapshot: monthly?.previous_budget_snapshot != null ? Number(monthly.previous_budget_snapshot) : undefined,
                  budgetChangedAt: monthly?.budget_changed_at ?? undefined,
                  actualRecordedAt: monthly?.actual_recorded_at ?? undefined,
                  inactivatedAt: monthly?.inactivated_at ?? undefined,
                };
              }),
              // One-time entries (e.g. from credit-import for un-budgeted
              // categories). Source-less rows live only in the month they were
              // charged; rendered read-only here so the user sees the history.
              ...monthlyExpenses
                .filter((m: any) => m.expense_id == null && m.one_time_name)
                .map((m: any) => {
                  const actualAmount = m.actual_amount != null ? Number(m.actual_amount) : undefined;
                  // Past months: click opens Details. Current month: no edit
                  // surface yet, so row stays non-interactive.
                  const readOnly = !isPastMonth;
                  return {
                    id: `onetime-${m.id}`,
                    name: m.one_time_name as string,
                    amount: actualAmount ?? 0,
                    budget: undefined,
                    actualAmount,
                    category: m.one_time_category as string | undefined,
                    isOneOff: true,
                    readOnly,
                  };
                }),
            ].sort((a, b) => (b.actualAmount ?? b.budget ?? 0) - (a.actualAmount ?? a.budget ?? 0))}
            subscriptions={[...subscriptions].sort((a, b) => parseFloat(String(b.budget)) - parseFloat(String(a.budget))).map(sub => {
              const isDue = sub.billing_cycle === 'monthly' || subsThisFm.has(sub.id);
              const isDueNext = subsNextFm.has(sub.id);
              const subj = subjects.find(s => s.id === sub.subject_id);
              const mem = members.find(m => m.id === sub.member_id);
              return {
                ...sub,
                name: sub.name || sub.service,
                category: sub.category,
                budget: sub.budget,
                isDue,
                isDueNext,
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
              const isDue = ins.billing_cycle === 'monthly' || insThisFm.has(ins.id);
              const isDueNext = insNextFm.has(ins.id);
              return {
                id: ins.id,
                name: customName || fallbackName,
                monthly_cost: monthlyAmount,
                budget: ins.budget,
                billing_cycle: ins.billing_cycle,
                category: ins.category,
                isDue,
                isDueNext,
                subject: subj ? { name: subj.name, type: subj.type } : undefined,
                member: mem ? { name: mem.profiles?.full_name ?? "Member" } : undefined,
                inactive: ins.is_active === false,
              };
            })}
            subscriptionsTotal={subscriptionsTotal}
            insuranceTotal={insuranceTotal}
            subscriptionSeverity={subscriptionSeverity}
            insuranceSeverity={insuranceSeverity}
            defaultExpanded={defaultExpanded}
            currency={household?.currency || "SEK"}
            pastMonth={isPastMonth}
            onExpenseClick={(id) => {
              if (id.startsWith("onetime-")) {
                if (!isPastMonth) return;
                const monthlyId = id.slice("onetime-".length);
                const monthly = monthlyExpenses.find((m: any) => m.id === monthlyId);
                if (!monthly) return;
                const cat = getCategoryById(monthly.one_time_category);
                setDetailsItem({
                  name: monthly.one_time_name,
                  categoryLabel: cat?.label,
                  icon: cat?.icon,
                  hue: cat?.hue,
                  currency: household?.currency || "SEK",
                  actualAmount: monthly.actual_amount != null ? Number(monthly.actual_amount) : undefined,
                  isOneOff: true,
                });
                return;
              }
              const expense = expenseCategories.find(cat => cat.id === id);
              if (!expense) return;
              if (isPastMonth) {
                const monthly = monthlyExpenses.find((m: any) => m.expense_id === expense.id);
                const cat = getCategoryById(expense.category);
                const subj = subjects.find(s => s.id === expense.subject_id);
                const mem = members.find(m => m.id === expense.member_id);
                setDetailsItem({
                  name: expense.name,
                  categoryLabel: cat?.label,
                  icon: cat?.icon,
                  hue: cat?.hue,
                  currency: household?.currency || "SEK",
                  budget: parseFloat(expense.budget || "0"),
                  actualAmount: monthly?.actual_amount != null ? Number(monthly.actual_amount) : undefined,
                  previousBudgetSnapshot: monthly?.previous_budget_snapshot != null ? Number(monthly.previous_budget_snapshot) : undefined,
                  budgetChangedAt: monthly?.budget_changed_at ?? undefined,
                  actualRecordedAt: monthly?.actual_recorded_at ?? undefined,
                  inactivatedAt: monthly?.inactivated_at ?? undefined,
                  subject: subj ? { name: subj.name, type: subj.type } : undefined,
                  member: mem ? { name: mem.profiles?.full_name ?? "Member" } : undefined,
                  isCredit: !!expense.is_credit,
                });
                return;
              }
              handleEditCategory(expense);
            }}
            onAddSubscription={() => !isReadOnly && setAddSubscriptionOpen(true)}
            onAddInsurance={() => !isReadOnly && setAddInsuranceOpen(true)}
            onSubscriptionClick={(id) => {
              const subscription = subscriptions.find(s => s.id === id);
              if (!subscription) return;
              if (isPastMonth) {
                const cat = subscriptionCategories.find(c => c.value === subscription.category);
                const subj = subjects.find(s => s.id === subscription.subject_id);
                const mem = members.find(m => m.id === subscription.member_id);
                const cycleLabels: Record<string, string> = { yearly: "/year", quarterly: "/quarter", monthly: "/month", semi_annually: "/6 mo" };
                setDetailsItem({
                  name: subscription.name || subscription.service,
                  categoryLabel: cat?.label,
                  icon: cat?.icon,
                  hue: cat?.hue,
                  currency: household?.currency || "SEK",
                  budget: parseFloat(String(subscription.budget || 0)),
                  billingLabel: cycleLabels[subscription.billing_cycle] || "/month",
                  subject: subj ? { name: subj.name, type: subj.type } : undefined,
                  member: mem ? { name: mem.profiles?.full_name ?? "Member" } : undefined,
                });
                return;
              }
              setEditingSubscription(subscription);
            }}
            onInsuranceClick={(id) => {
              const insurance = insurances.find(i => i.id === id);
              if (!insurance) return;
              if (isPastMonth) {
                const cat = insuranceTypes.find(t => t.value === insurance.category);
                const subj = subjects.find(s => s.id === insurance.subject_id);
                const mem = members.find(m => m.id === insurance.member_id);
                const cycleLabels: Record<string, string> = { yearly: "/year", quarterly: "/quarter", monthly: "/month", semi_annually: "/6 mo" };
                const rawName = typeof insurance.name === "string" ? insurance.name.trim() : "";
                const customName = rawName === "NaN" ? "" : rawName;
                setDetailsItem({
                  name: customName || cat?.label || "Insurance",
                  categoryLabel: cat?.label,
                  icon: cat?.icon,
                  hue: cat?.hue,
                  currency: household?.currency || "SEK",
                  budget: parseFloat(String(insurance.budget || 0)),
                  billingLabel: cycleLabels[insurance.billing_cycle] || "/month",
                  subject: subj ? { name: subj.name, type: subj.type } : undefined,
                  member: mem ? { name: mem.profiles?.full_name ?? "Member" } : undefined,
                });
                return;
              }
              setEditingInsurance(insurance);
            }}
          />


          {!isPastMonth && (
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
          )}
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
            budget: editingSubscription.budget,
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

      <PastMonthDetailsDialog
        open={!!detailsItem}
        onOpenChange={(o) => !o && setDetailsItem(null)}
        item={detailsItem}
      />
    </div>
  );
};

export default Expenses;
