import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
import { Card } from "@/components/ui/card";
import { Money, fmtKr } from "@/components/ui/money";
import { MonthChip } from "@/components/ui/month-chip";
import { MetricTile } from "@/components/ui/metric-tile";
import { CoParentSettlementCard } from "@/components/dashboard/CoParentSettlementCard";
import { MonthlyReviewWizard, useMonthlyReviewStatus } from "@/components/dashboard/MonthlyReviewWizard";
import { TrendingUp, TrendingDown, Repeat, Shield, ClipboardCheck, ChevronRight, Users, Sparkles } from "lucide-react";
import { LoadingState } from "@/components/shared/states";
import {
  useEncryptedFields,
  monthlyIncomeFields,
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
  kind: "shared" | "one_time_income";
  name: string;
  amount: number; // signed: negative = outflow (shared expense), positive = inflow (income)
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

interface DashboardData {
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

const Dashboard = () => {
  const { user } = useAuth();
  const { household, coParents, financialMonthStart, loading: householdLoading } = useHousehold();
  const { isUnlocked } = useEncryption();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
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

  // Encryption hooks
  const { decryptRecords: decryptIncomes } = useEncryptedFields(monthlyIncomeFields);
  const { decryptRecords: decryptExpenses } = useEncryptedFields(monthlyExpenseFields);
  const { decryptRecords: decryptSubscriptions } = useEncryptedFields(subscriptionFields);
  const { decryptRecords: decryptInsurances } = useEncryptedFields(insuranceFields);
  const { decryptRecords: decryptShared } = useEncryptedFields(sharedExpenseFields);

  // Current financial month label for the chip
  const currentMonth = getCurrentFinancialMonth(financialMonthStart);
  const { end: monthEnd } = getFinancialMonthRange(currentMonth, financialMonthStart);
  const monthLabel = format(monthEnd, "MMM yyyy");

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !household?.id || householdLoading) return;
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
        { data: monthlyIncomes },
        { data: monthlyExpenses },
        { data: subscriptions },
        { data: insurances },
        { data: sharedExpenses },
      ] = results;

      const decryptedIncomes = await decryptIncomes(monthlyIncomes || []);
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

      const pickAmount = (item: any): number =>
        parseFloat(item.actual_amount ?? item.budget_amount ?? item.amount) || 0;

      const totalIncome = uniqueIncomes.reduce((sum: number, item: any) => sum + pickAmount(item), 0);
      const totalMonthlyExpenses = uniqueExpenses.reduce((sum: number, item: any) => sum + pickAmount(item), 0);

      let subscriptionsMonthly = 0;
      let subscriptionsYearly = 0;
      decryptedSubs.forEach((sub: any) => {
        const amount = parseFloat(sub.amount || "0");
        if (sub.billing_cycle === "yearly") {
          subscriptionsYearly += amount;
        } else if (sub.billing_cycle === "quarterly") {
          subscriptionsYearly += amount * 4;
        } else {
          subscriptionsYearly += amount * 12;
        }
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
              (sub.billing_month - 1 + 9) % 12,
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

      let insuranceMonthly = 0;
      let insuranceYearly = 0;
      decryptedInsurances.forEach((ins: any) => {
        const totalAmount = parseFloat(ins.total_amount || "0");
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
            amount: parseFloat(m.amount) || 0,
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
  }, [user, household, householdLoading, isUnlocked]);

  // ─── Loading + locked states ─────────────────────────────────
  if (householdLoading || loading) {
    return (
      <div className="space-y-5">
        <DashboardHeader monthLabel={monthLabel} />
        <LoadingState />
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="space-y-5">
        <DashboardHeader monthLabel={monthLabel} hideMonthChip />
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

  return (
    <div className="space-y-5">
      <DashboardHeader monthLabel={monthLabel} />

      {/* Monthly Review Banner */}
      {needsReview && !isDemoMode() && (
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

      <div className={`space-y-5 ${needsReview && !isDemoMode() ? "opacity-50" : ""} transition-opacity`}>
        {/* HERO — survival on top, after-savings below */}
        <Card variant="flush">
          <div className="p-5 border-b border-line-2">
            <p className="text-xs font-medium text-muted-foreground tracking-wide">
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
                <p className="text-xs font-medium text-muted-foreground tracking-wide">
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
              <p className="mt-1.5 text-xs text-muted-foreground">
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
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-accent" />
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
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingDown className="h-3 w-3" />
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
            <div className="flex items-baseline justify-between mb-3 px-0.5">
              <h2 className="text-[11.5px] font-semibold text-muted-foreground tracking-[0.08em] uppercase">
                Recurring
              </h2>
              <button
                type="button"
                onClick={() => navigate("/expenses?tab=all")}
                className="text-[12.5px] font-semibold text-accent-dk hover:underline"
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
              {coParents.length > 0 && (
                <MetricTile
                  icon={Users}
                  label={`${coParents[0].name || "Co-parent"} shares`}
                  primary={0}
                  primaryLabel="see settlement below"
                  tone="accent"
                />
              )}
            </div>
          </section>
        )}

        {/* RECENT ACTIVITY */}
        {data.activity.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-3 px-0.5">
              <h2 className="text-[11.5px] font-semibold text-muted-foreground tracking-[0.08em] uppercase">
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
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.kind === "shared" ? "Shared expense" : "One-time income"}
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

      {/* Co-Parent Settlement */}
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

interface DashboardHeaderProps {
  monthLabel: string;
  hideMonthChip?: boolean;
}

const DashboardHeader = ({ monthLabel, hideMonthChip = false }: DashboardHeaderProps) => (
  <div className="flex items-center justify-between gap-4">
    <h1>Dashboard</h1>
    {!hideMonthChip && <MonthChip value={monthLabel} />}
  </div>
);

export default Dashboard;
