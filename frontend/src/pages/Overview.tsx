import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import {
  getCurrentFinancialMonth,
  getFinancialMonthRange,
  getPreviousFinancialMonth,
} from "@/utils/dateUtils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money, fmtKr } from "@/components/ui/money";
import { MonthChip } from "@/components/ui/month-chip";
import { MonthPickerPopover } from "@/components/shared/MonthPickerPopover";
import { MetricTile } from "@/components/ui/metric-tile";
import { CoParentSettlementDialog } from "@/components/overview/CoParentSettlementDialog";
import { useCoParentSettlements } from "@/hooks/useCoParentSettlements";
import { MonthlyReviewWizard, useMonthlyReviewStatus } from "@/components/overview/MonthlyReviewWizard";
import { HouseholdSetupWizard } from "@/components/overview/HouseholdSetupWizard";
import {
  HandCoins, Wallet, Repeat, Shield, ClipboardCheck,
  ChevronRight, Users, Sparkles, CalendarPlus, Loader2, Zap,
} from "lucide-react";
import { planMonth } from "@/services/monthlyPlanning";
import { toast } from "sonner";
import { OverviewSkeleton } from "@/components/shared/skeletons/PageSkeletons";
import { AvatarTrigger } from "@/components/shared/AvatarTrigger";
import { UserMenu } from "@/components/shared/UserMenu";
import {
  useEncryptedFields,
  incomeSourceFields,
  monthlyIncomeFields,
  expenseFields,
  monthlyExpenseFields,
  subscriptionFields,
  insuranceFields,
  sharedExpenseFields,
} from "@/hooks/useEncryptedFields";
import { VaultLockedAlert } from "@/components/shared/VaultLockedAlert";
import { useEncryption } from "@/contexts/EncryptionContext";
import { DemoEncryptionCard } from "@/components/demo/DemoEncryptionCard";
import { isDemoMode } from "@/utils/demoMode";
import { reportSuccess, reportFailure, isDown } from "@/utils/outageMonitor";

interface ActivityItem {
  id: string;
  kind: "shared" | "one_time_income" | "one_time_expense";
  name: string;
  amount: number; // signed: negative = outflow, positive = inflow
  when: Date;
}

const formatRelative = (d: Date): string => {
  const now = Date.now();
  const ms = now - d.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days < 2) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return format(d, "d MMM");
};

interface OverviewData {
  income: number;
  expenses: number;
  mandatoryOutflow: number;
  savingsOutflow: number;
  subscriptionsMonthly: number;
  subscriptionsYearly: number;
  subscriptionsCount: number;
  insuranceMonthly: number;
  insuranceYearly: number;
  insuranceCount: number;
  activity: ActivityItem[];
}

const Overview = () => {
  const { user } = useAuth();
  const { household, coParents, members, financialMonthStart, loading: householdLoading, dataVersion } = useHousehold();
  const { isUnlocked, encrypt, decrypt, pendingExitHouseholdId, recoveryCodeDialogOpen } = useEncryption();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentFinancialMonth(financialMonthStart));
  const [householdHasSeedData, setHouseholdHasSeedData] = useState<boolean | null>(null);
  const [hasPriorMonthData, setHasPriorMonthData] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [openSettlementCoParentId, setOpenSettlementCoParentId] = useState<string | null>(null);
  const { settlements, refetch: refetchSettlements } = useCoParentSettlements({ householdId: household?.id, coParents });
  const [data, setData] = useState<OverviewData>({
    income: 0,
    expenses: 0,
    mandatoryOutflow: 0,
    savingsOutflow: 0,
    subscriptionsMonthly: 0,
    subscriptionsYearly: 0,
    subscriptionsCount: 0,
    insuranceMonthly: 0,
    insuranceYearly: 0,
    insuranceCount: 0,
    activity: [],
  });
  const [currency, setCurrency] = useState("SEK");
  const [householdId, setHouseholdId] = useState<string>("");
  const [reviewWizardOpen, setReviewWizardOpen] = useState(false);

  const { needsReview, markAsReviewed } = useMonthlyReviewStatus(household?.id, financialMonthStart);

  const { decryptRecords: decryptIncomeSources } = useEncryptedFields(incomeSourceFields);
  const { decryptRecords: decryptIncomes } = useEncryptedFields(monthlyIncomeFields);
  const { decryptRecords: decryptExpenseSources } = useEncryptedFields(expenseFields);
  const { decryptRecords: decryptExpenses } = useEncryptedFields(monthlyExpenseFields);
  const { decryptRecords: decryptSubscriptions } = useEncryptedFields(subscriptionFields);
  const { decryptRecords: decryptInsurances } = useEncryptedFields(insuranceFields);
  const { decryptRecords: decryptShared } = useEncryptedFields(sharedExpenseFields);

  const todayMonth = getCurrentFinancialMonth(financialMonthStart);
  const { start: selectedStart, end: monthEnd } = getFinancialMonthRange(selectedMonth, financialMonthStart);
  const monthLabel = format(monthEnd, "MMM yyyy");
  const isFutureMonth = parseISO(selectedMonth).getTime() > parseISO(todayMonth).getTime();
  const isCurrentMonth = selectedMonth === todayMonth;

  useEffect(() => {
    const fetchData = async () => {
      if (!user || householdLoading) return;
      // Stranded after leave: HouseholdContext finished with no active
      // household. Drop loading so the VaultLockedAlert below can surface and
      // the user can re-unlock (which triggers ensure_user_has_household).
      if (!household?.id) {
        setLoading(false);
        return;
      }
      if (!isUnlocked) {
        setLoading(false);
        return;
      }
      if (isDown()) {
        setLoading(false);
        return;
      }

      setHouseholdId(household.id);

      const fms = household?.financial_month_start || 25;
      const { start: fetchStart, end: fetchEnd } = getFinancialMonthRange(selectedMonth, fms);
      const startStr = format(fetchStart, "yyyy-MM-dd");
      const endStr = format(fetchEnd, "yyyy-MM-dd");

      let results;
      try {
        results = await Promise.all([
          supabase.from("income_sources").select("id, encrypted_budget, is_encrypted").eq("household_id", household.id).eq("is_active", true).is("archived_at", null),
          supabase.from("monthly_incomes").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
          supabase.from("expenses").select("id, encrypted_budget, is_encrypted").eq("household_id", household.id).is("archived_at", null),
          supabase.from("monthly_expenses").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
          supabase.from("subscriptions").select("encrypted_budget, billing_cycle, billing_month, billing_day, is_encrypted").eq("household_id", household.id).eq("is_active", true).is("archived_at", null),
          supabase.from("insurances").select("encrypted_budget, billing_cycle, is_shared, share_percentage, is_encrypted").eq("household_id", household.id).eq("is_active", true).is("archived_at", null),
          supabase.from("shared_expenses").select("id, encrypted_amount, encrypted_description, paid_by, is_encrypted, created_at").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr).order("created_at", { ascending: false }),
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
        { data: incomeSources },
        { data: monthlyIncomes },
        { data: expenseSources },
        { data: monthlyExpenses },
        { data: subscriptions },
        { data: insurances },
        { data: sharedExpenses },
      ] = results;

      const decryptedIncomeSources = await decryptIncomeSources(incomeSources || []);
      const decryptedIncomes = await decryptIncomes(monthlyIncomes || []);
      const decryptedExpenseSources = await decryptExpenseSources(expenseSources || []);
      const decryptedExpenses = await decryptExpenses(monthlyExpenses || []);
      const decryptedSubs = await decryptSubscriptions(subscriptions || []);
      const decryptedInsurances = await decryptInsurances(insurances || []);
      const decryptedShared = await decryptShared(sharedExpenses || []);

      const deduplicateItems = (items: any[], sourceIdField: string) => {
        const uniqueItems: Record<string, any> = {};
        const oneTimeItems: any[] = [];
        (items || []).forEach(item => {
          const sourceId = item[sourceIdField];
          if (sourceId) {
            if (uniqueItems[sourceId]) {
              const existingDate = new Date(uniqueItems[sourceId].updated_at || uniqueItems[sourceId].created_at);
              const newDate = new Date(item.updated_at || item.created_at);
              if (newDate > existingDate) uniqueItems[sourceId] = item;
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

      const monthlyByIncomeSource = new Map<string, any>(
        uniqueIncomes
          .filter((m: any) => m.income_source_id)
          .map((m: any) => [m.income_source_id, m]),
      );
      const monthlyByExpenseSource = new Map<string, any>(
        uniqueExpenses
          .filter((m: any) => m.expense_id)
          .map((m: any) => [m.expense_id, m]),
      );

      const resolveSourceAmount = (source: any, monthly: any | undefined): number => {
        if (monthly?.actual_amount != null) return Number(monthly.actual_amount) || 0;
        if (monthly?.budget_snapshot != null) return Number(monthly.budget_snapshot) || 0;
        return parseFloat((source.budget ?? "0").toString()) || 0;
      };

      const recurringIncomeTotal = decryptedIncomeSources.reduce((sum: number, source: any) => {
        return sum + resolveSourceAmount(source, monthlyByIncomeSource.get(source.id));
      }, 0);
      const recurringExpensesTotal = decryptedExpenseSources.reduce((sum: number, source: any) => {
        return sum + resolveSourceAmount(source, monthlyByExpenseSource.get(source.id));
      }, 0);

      const oneTimeIncome = uniqueIncomes
        .filter((m: any) => !m.income_source_id)
        .reduce((sum: number, m: any) => sum + (parseFloat(m.actual_amount ?? m.budget_snapshot) || 0), 0);
      const oneTimeExpenses = uniqueExpenses
        .filter((m: any) => !m.expense_id)
        .reduce((sum: number, m: any) => sum + (parseFloat(m.actual_amount ?? m.budget_snapshot) || 0), 0);

      const totalIncome = recurringIncomeTotal + oneTimeIncome;
      const totalMonthlyExpenses = recurringExpensesTotal + oneTimeExpenses;

      // Amortized monthly + annualised totals — see docs/design/expenses-model.md.
      let subscriptionsMonthly = 0;
      let subscriptionsYearly = 0;
      decryptedSubs.forEach((sub: any) => {
        const amount = parseFloat(sub.budget || "0");
        if (sub.billing_cycle === "yearly") {
          subscriptionsMonthly += amount / 12;
          subscriptionsYearly += amount;
        } else if (sub.billing_cycle === "semi_annually") {
          subscriptionsMonthly += amount / 6;
          subscriptionsYearly += amount * 2;
        } else if (sub.billing_cycle === "quarterly") {
          subscriptionsMonthly += amount / 3;
          subscriptionsYearly += amount * 4;
        } else {
          subscriptionsMonthly += amount;
          subscriptionsYearly += amount * 12;
        }
      });

      let insuranceMonthly = 0;
      let insuranceYearly = 0;
      decryptedInsurances.forEach((ins: any) => {
        const totalAmount = parseFloat(ins.budget || "0");
        let monthlyAmount = 0;
        let yearlyAmount = 0;
        if (ins.billing_cycle === "yearly") {
          monthlyAmount = totalAmount / 12;
          yearlyAmount = totalAmount;
        } else if (ins.billing_cycle === "semi_annually") {
          monthlyAmount = totalAmount / 6;
          yearlyAmount = totalAmount * 2;
        } else if (ins.billing_cycle === "quarterly") {
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

      const totalShared = decryptedShared.reduce((sum: number, item: any) => {
        return sum + (item.paid_by === "user" ? (parseFloat(item.amount) || 0) : -(parseFloat(item.amount) || 0));
      }, 0);

      const mandatoryOutflow = totalMonthlyExpenses + subscriptionsMonthly + totalShared;
      const savingsOutflow = insuranceMonthly;
      const totalExpenses = mandatoryOutflow + savingsOutflow;

      // Build activity feed from one-time incomes + shared expenses (current month).
      // Recurring monthly entries are excluded — they're "budget values", not events.
      const activity: ActivityItem[] = [
        ...decryptedShared.map((s: any) => ({
          id: s.id,
          kind: "shared" as const,
          name: s.description || "Shared expense",
          amount: -(parseFloat(s.amount) || 0),
          when: new Date(s.created_at),
        })),
        ...decryptedIncomes
          .filter((m: any) => m.income_source_id == null && m.one_time_name)
          .map((m: any) => ({
            id: m.id,
            kind: "one_time_income" as const,
            name: m.one_time_name,
            amount: parseFloat(m.actual_amount ?? m.budget_snapshot) || 0,
            when: new Date(m.created_at),
          })),
        ...decryptedExpenses
          .filter((m: any) => m.expense_id == null && m.one_time_name)
          .map((m: any) => ({
            id: m.id,
            kind: "one_time_expense" as const,
            name: m.one_time_name,
            amount: -(parseFloat(m.actual_amount ?? m.budget_snapshot) || 0),
            when: new Date(m.created_at),
          })),
      ]
        .sort((a, b) => b.when.getTime() - a.when.getTime())
        .slice(0, 5);

      setData({
        income: totalIncome,
        expenses: totalExpenses,
        mandatoryOutflow,
        savingsOutflow,
        subscriptionsMonthly,
        subscriptionsYearly,
        subscriptionsCount: decryptedSubs.length,
        insuranceMonthly,
        insuranceYearly,
        insuranceCount: decryptedInsurances.length,
        activity,
      });
      setCurrency(household.currency || "SEK");
      setLoading(false);
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.id, householdLoading, isUnlocked, selectedMonth, dataVersion]);

  useEffect(() => {
    const checkSeedData = async () => {
      if (!household?.id || !isUnlocked) return;
      const [incomeRows, expenseRows, priorExpenseRows, priorIncomeRows] = await Promise.all([
        supabase.from("income_sources").select("id").eq("household_id", household.id).is("archived_at", null).limit(1),
        supabase.from("expenses").select("id").eq("household_id", household.id).is("archived_at", null).limit(1),
        supabase.from("monthly_expenses").select("id").eq("household_id", household.id).lt("month", todayMonth).limit(1),
        supabase.from("monthly_incomes").select("id").eq("household_id", household.id).lt("month", todayMonth).limit(1),
      ]);
      const hasPrior = (priorExpenseRows.data?.length ?? 0) > 0 || (priorIncomeRows.data?.length ?? 0) > 0;
      setHasPriorMonthData(hasPrior);
      const hasSeed = (incomeRows.data?.length ?? 0) > 0 || (expenseRows.data?.length ?? 0) > 0;
      setHouseholdHasSeedData(hasSeed);

      const setupDone = localStorage.getItem(`hh_setup_done_${household.id}`) === "1";
      const explicitOpen = searchParams.get("setup") === "1";
      // The exit dialog owns the welcome experience while a pending exit is unresolved.
      // Recovery code modal must come BEFORE setup wizard — risk of losing access if
      // user adds data without saving their recovery code first.
      if (pendingExitHouseholdId || recoveryCodeDialogOpen) {
        setSetupOpen(false);
      } else if (explicitOpen || (!hasSeed && !setupDone)) {
        setSetupOpen(true);
      } else if (hasSeed) {
        localStorage.setItem(`hh_setup_done_${household.id}`, "1");
      }
      if (explicitOpen) {
        searchParams.delete("setup");
        setSearchParams(searchParams, { replace: true });
      }
    };
    checkSeedData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.id, isUnlocked, todayMonth, pendingExitHouseholdId, recoveryCodeDialogOpen]);

  // ─── Loading + locked states ─────────────────────────────────
  if (householdLoading || loading) {
    return (
      <div className="space-y-5">
        <OverviewHeader monthLabel={monthLabel} hideMonthChip />
        <OverviewSkeleton />
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="space-y-5">
        <OverviewHeader monthLabel={monthLabel} hideMonthChip />
        <VaultLockedAlert />
      </div>
    );
  }

  // ─── Derived values ──────────────────────────────────────────
  const survival = data.income - data.mandatoryOutflow;
  const afterSavings = survival - data.savingsOutflow;
  const survivalPositive = survival >= 0;
  const afterPositive = afterSavings >= 0;
  const usedPct = data.income > 0
    ? Math.min(100, Math.round((data.expenses / data.income) * 100))
    : 0;
  const showRecurringTiles = data.subscriptionsCount > 0 || data.insuranceCount > 0;
  const monthIsEmpty = data.income === 0 && data.expenses === 0;
  const showPlanCta = isFutureMonth && monthIsEmpty;

  const handlePlan = async () => {
    if (!user || !household) return;
    setPlanning(true);
    try {
      const previousMonth = getPreviousFinancialMonth(selectedMonth, financialMonthStart);
      const result = await planMonth({
        householdId: household.id,
        userId: user.id,
        targetMonth: selectedStart,
        previousMonth: parseISO(previousMonth),
        encrypt,
        decrypt,
      });
      const total = result.expensesPlanned + result.incomesPlanned;
      if (total > 0) {
        toast.success(`Planned ${total} item${total === 1 ? "" : "s"} for ${monthLabel}`);
      } else {
        toast.info(`Nothing to carry forward from last month.`);
      }
      setSelectedMonth(selectedMonth);
      window.location.reload();
    } catch (err: any) {
      console.error("Failed to plan month:", err);
      toast.error(err.message || "Failed to plan month");
    } finally {
      setPlanning(false);
    }
  };

  return (
    <div className="space-y-5">
      <OverviewHeader
        selectedMonth={selectedMonth}
        financialMonthStart={financialMonthStart}
        onSelectMonth={setSelectedMonth}
      />

      {householdHasSeedData === false && !setupOpen && (
        <Card variant="cta" className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-accent-dk" />
            <div>
              <p className="font-medium text-sm text-accent-dk">Resume setup</p>
              <p className="text-xs text-accent-dk/70">Add your incomes, expenses, subscriptions and insurances.</p>
            </div>
          </div>
          <Button onClick={() => setSetupOpen(true)}>Open setup</Button>
        </Card>
      )}

      {showPlanCta && householdHasSeedData !== false && (
        <Card variant="cta" className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarPlus className="h-5 w-5 text-accent-dk" />
            <div>
              <p className="font-medium text-sm text-accent-dk">Plan {monthLabel}</p>
              <p className="text-xs text-accent-dk/70">Carries last month's actuals into this month's budgets.</p>
            </div>
          </div>
          <Button onClick={handlePlan} disabled={planning}>
            {planning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Planning…</> : "Plan this month"}
          </Button>
        </Card>
      )}

      {/* Monthly Review Banner — suppressed while the household has no data yet */}
      {needsReview && !isDemoMode() && householdHasSeedData !== false && hasPriorMonthData && (
        <Card
          variant="cta"
          className="flex items-center justify-between"
          onClick={() => setReviewWizardOpen(true)}
        >
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-accent-dk" />
            <div>
              <p className="font-medium text-sm text-accent-dk">New month! Review your finances</p>
              <p className="text-xs text-accent-dk/70">Confirm your income and expenses are up to date</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-accent-dk" />
        </Card>
      )}

      {/* Demo Encryption Showcase */}
      <DemoEncryptionCard householdId={householdId} />

      {householdHasSeedData !== false && (
        <div className={`space-y-5 ${needsReview && !isDemoMode() && hasPriorMonthData ? "opacity-50" : ""} transition-opacity`}>
          {/* HERO — survival on top, after-savings below */}
          <Card variant="flush">
            <div className="p-5 border-b border-line-2">
              <p className="text-xs font-medium text-muted tracking-wide">
                After mandatory bills
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <Money
                  v={survival}
                  currency={currency}
                  size="4xl"
                  weight={600}
                  color={survivalPositive ? "accent" : "danger"}
                  className="tracking-tighter"
                />
              </div>
              {data.savingsOutflow > 0 && (
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-xs font-medium text-muted tracking-wide">
                    After savings
                  </p>
                  <Money
                    v={afterSavings}
                    currency={currency}
                    size="base"
                    weight={500}
                    color={afterPositive ? "accent" : "danger"}
                  />
                </div>
              )}
              <div className="mt-3">
                <div className="h-1.5 bg-line-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${afterPositive ? "bg-accent" : "bg-danger"}`}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  {usedPct}% of income used
                </p>
              </div>
            </div>

            {/* Income / Expenses split */}
            <div className="grid grid-cols-2">
              <button
                type="button"
                onClick={() => navigate("/income")}
                className="p-4 px-5 text-left border-r border-line-2 hover:bg-surface-2 transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <HandCoins className="h-3 w-3 text-accent" />
                  <span>Income</span>
                </div>
                <div className="mt-1">
                  <Money v={data.income} currency={currency} size="lg" weight={600} />
                </div>
              </button>
              <button
                type="button"
                onClick={() => navigate("/expenses")}
                className="p-4 px-5 text-left hover:bg-surface-2 transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Wallet className="h-3 w-3" />
                  <span>Expenses</span>
                </div>
                <div className="mt-1">
                  <Money v={data.expenses} currency={currency} size="lg" weight={600} />
                </div>
              </button>
            </div>
          </Card>

          {/* RECURRING tiles */}
          {showRecurringTiles && (
            <section>
              <div className="flex items-baseline justify-between mb-1.5 px-0.5">
                <h2 className="text-[11.5px] font-semibold text-muted tracking-[0.08em] uppercase leading-none">
                  Recurring
                </h2>
                <button
                  type="button"
                  onClick={() => navigate("/expenses?tab=all")}
                  className="text-[12.5px] font-semibold text-accent-dk hover:underline leading-none"
                >
                  See all →
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {data.subscriptionsCount > 0 && (
                  <MetricTile
                    icon={Repeat}
                    label="Subscriptions"
                    primary={data.subscriptionsMonthly}
                    primaryLabel="per month"
                    secondary={`${fmtKr(data.subscriptionsYearly, currency)}/yr`}
                    count={data.subscriptionsCount}
                    currency={currency}
                    onClick={() => navigate("/expenses?tab=all")}
                  />
                )}
                {data.insuranceCount > 0 && (
                  <MetricTile
                    icon={Shield}
                    label="Insurance"
                    primary={data.insuranceMonthly}
                    primaryLabel="per month"
                    secondary={`${fmtKr(data.insuranceYearly, currency)}/yr`}
                    count={data.insuranceCount}
                    currency={currency}
                    onClick={() => navigate("/expenses?tab=all")}
                  />
                )}
                {coParents.map((cp) => {
                  const settlement = settlements[cp.id];
                  const balance = settlement?.netAmount ?? 0;
                  const abs = Math.abs(balance);
                  const direction = abs === 0
                    ? "Settled"
                    : balance > 0
                      ? `You owe ${cp.name}`
                      : `${cp.name} owes you`;
                  return (
                    <MetricTile
                      key={cp.id}
                      icon={Users}
                      label={`${cp.name || "Co-parent"} shares`}
                      primary={abs}
                      primaryLabel={direction}
                      secondary="See settlement"
                      tone="accent"
                      onClick={() => setOpenSettlementCoParentId(cp.id)}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* RECENT ACTIVITY */}
          {data.activity.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between mb-1.5 px-0.5">
                <h2 className="text-[11.5px] font-semibold text-muted tracking-[0.08em] uppercase leading-none">
                  Recent activity
                </h2>
              </div>
              <Card variant="flush">
                <ul>
                  {data.activity.map((item, idx) => (
                    <li
                      key={item.id}
                      className={`flex items-center gap-3 px-4 py-3 ${idx < data.activity.length - 1 ? "border-b border-line-2" : ""
                        }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center text-ink-2 shrink-0">
                        {item.kind === "shared" ? (
                          <Users className="h-4 w-4" />
                        ) : item.kind === "one_time_expense" ? (
                          <Zap className="h-4 w-4" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{item.name}</p>
                        <p className="text-xs text-muted">
                          {item.kind === "shared" ? "Shared expense"
                            : item.kind === "one_time_expense" ? "One-off expense"
                              : "One-off income"}
                          {" · "}
                          {formatRelative(item.when)}
                        </p>
                      </div>
                      <Money
                        v={item.amount}
                        currency={currency}
                        size="sm"
                        weight={600}
                        color={item.amount >= 0 ? "accent" : "ink"}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </div>
      )}

      {householdId && coParents.map((cp) => {
        const settlement = settlements[cp.id];
        if (!settlement) return null;
        return (
          <CoParentSettlementDialog
            key={cp.id}
            open={openSettlementCoParentId === cp.id}
            onOpenChange={(open) => setOpenSettlementCoParentId(open ? cp.id : null)}
            householdId={householdId}
            coParent={cp}
            settlement={settlement}
            currency={currency}
            onSettled={refetchSettlements}
          />
        );
      })}

      {/* Monthly Review Wizard */}
      <MonthlyReviewWizard
        open={reviewWizardOpen}
        onOpenChange={setReviewWizardOpen}
        onComplete={markAsReviewed}
      />

      {household && (
        <HouseholdSetupWizard
          open={setupOpen}
          onOpenChange={setSetupOpen}
          householdId={household.id}
          members={members}
          financialMonthStart={financialMonthStart}
          onComplete={() => {
            setHouseholdHasSeedData(true);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

interface OverviewHeaderProps {
  monthLabel?: string;
  selectedMonth?: string;
  financialMonthStart?: number;
  onSelectMonth?: (m: string) => void;
  hideMonthChip?: boolean;
}

const OverviewHeader = ({
  monthLabel,
  selectedMonth,
  financialMonthStart,
  onSelectMonth,
  hideMonthChip = false,
}: OverviewHeaderProps) => (
  <div className="flex items-center justify-between gap-4 min-h-9">
    <h1>Overview</h1>
    <div className="flex items-center gap-2">
      {hideMonthChip ? (
        <div className="invisible">
          <MonthChip value={monthLabel ?? ""} />
        </div>
      ) : (
        selectedMonth && financialMonthStart !== undefined && onSelectMonth && (
          <MonthPickerPopover
            selectedMonth={selectedMonth}
            financialMonthStart={financialMonthStart}
            onSelect={onSelectMonth}
          />
        )
      )}
      <div className="md:hidden">
        <UserMenu trigger={<AvatarTrigger />} />
      </div>
    </div>
  </div>
);

export default Overview;
