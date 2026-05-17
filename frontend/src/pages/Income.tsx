import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { HandCoins, ClipboardCheck, ChevronLeft, ChevronRight, Plus, Calculator } from "lucide-react";
import { Alert, AlertContent, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { MonthPickerPopover } from "@/components/shared/MonthPickerPopover";
import { Money, fmtKr } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { TaxPrognosisModal } from "@/components/income/TaxPrognosisModal";
import { getTaxPrognosis } from "@/services/tax";
import type { IncomeForTax, TaxPrognosisResult } from "@/types/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { IncomeSourceItem } from "@/components/income/IncomeSourceItem";
import { IncomeFormDialog } from "@/components/income/IncomeFormDialog";
import { OneTimeIncomeDialog } from "@/components/income/OneTimeIncomeDialog";

import { getCurrentFinancialMonth, getFinancialMonthRange, getPreviousFinancialMonth, getNextFinancialMonth } from "@/utils/dateUtils";
import { reportSuccess, reportFailure, isDown } from "@/utils/outageMonitor";
import { useMonthlyReviewStatus } from "@/components/overview/MonthlyReviewWizard";

import { IncomePageSkeleton } from "@/components/shared/skeletons/PageSkeletons";
import { AvatarTrigger } from "@/components/shared/AvatarTrigger";
import { UserMenu } from "@/components/shared/UserMenu";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileBottomBar, mobileBottomBarSpacer } from "@/components/shared/MobileBottomBar";
import { EmptyStateCard } from "@/components/shared/EmptyStateCard";
import { useEncryptedFields, incomeSourceFields, monthlyIncomeFields } from "@/hooks/useEncryptedFields";

import { VaultLockedAlert } from "@/components/shared/VaultLockedAlert";
import { useEncryption } from "@/contexts/EncryptionContext";
import { useEarliestDataMonth } from "@/hooks/useEarliestDataMonth";

const Income = () => {
  const { user } = useAuth();
  const { isUnlocked } = useEncryption();
  const { household, members, coParents, financialMonthStart, loading: householdLoading } = useHousehold();
  const earliestDataMonth = useEarliestDataMonth(household?.id);
  const { toast } = useToast();
  const [incomeSources, setIncomeSources] = useState<any[]>([]);
  const [monthlyIncomes, setMonthlyIncomes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tax prognosis state
  const [prognosisOpen, setPrognosisOpen] = useState(false);
  const [prognosisLoading, setPrognosisLoading] = useState(false);
  const [prognosis, setPrognosis] = useState<TaxPrognosisResult | null>(null);

  const handleViewPrognosis = async () => {
    setPrognosisOpen(true);
    setPrognosisLoading(true);
    setPrognosis(null);
    try {
      const incomesForTax: IncomeForTax[] = incomeSources
        .filter((s: any) => s.is_active !== false && s.tax_type)
        .map((s: any) => ({
          gross_monthly: parseFloat(s.budget || "0") || 0,
          tax_type: s.tax_type,
          custom_rate: s.custom_tax_rate ?? undefined,
        }))
        .filter(i => i.gross_monthly > 0);

      if (incomesForTax.length === 0) {
        toast({
          title: "No taxable income",
          description: "Add an active income source with a tax type to see a prognosis.",
          variant: "destructive",
        });
        setPrognosisOpen(false);
        return;
      }

      const result = await getTaxPrognosis(incomesForTax);
      setPrognosis(result);
    } catch (err) {
      toast({
        title: "Couldn't fetch prognosis",
        description: err instanceof Error ? err.message : "Try again in a moment.",
        variant: "destructive",
      });
      setPrognosisOpen(false);
    } finally {
      setPrognosisLoading(false);
    }
  };

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
      .from("monthly_incomes")
      .select("id", { count: "exact", head: true })
      .eq("household_id", household.id)
      .lt("month", todayMonth)
      .then(({ count }) => setHasPriorMonthData((count ?? 0) > 0));
  }, [household?.id, todayMonth]);
  const isReadOnly = isCurrentMonth && needsReview && hasPriorMonthData;
  const initialDefaultRef = useRef(false);
  useEffect(() => {
    // On first load, if the current month is unfinalized and there's a previous
    // finalized month, default to that so users see the last "locked in" data.
    if (initialDefaultRef.current) return;
    if (needsReview && latestFinalizedMonth && selectedMonth === todayMonth) {
      setSelectedMonth(latestFinalizedMonth);
    }
    initialDefaultRef.current = true;
  }, [needsReview, latestFinalizedMonth, selectedMonth, todayMonth]);

  const currentMonth = selectedMonth;

  // Encryption hooks for income data
  const { decryptRecords: decryptSources } = useEncryptedFields(incomeSourceFields);
  const { decryptRecords: decryptIncomes, encryptRecord: encryptIncome } = useEncryptedFields(monthlyIncomeFields);

  const fetchData = useCallback(async () => {
    if (!household?.id) return;

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
    const fetchMonth = selectedMonth;
    const { start: fetchStart, end: fetchEnd } = getFinancialMonthRange(fetchMonth, financialMonthStart);
    const startStr = format(fetchStart, "yyyy-MM-dd");
    const endStr = format(fetchEnd, "yyyy-MM-dd");

    let sourcesResult, monthlyResult;
    try {
      [sourcesResult, monthlyResult] = await Promise.all([
        supabase.from("income_sources").select("*, profiles(full_name, avatar_url)").eq("household_id", household.id).eq("is_active", true).order("created_at", { ascending: true }),
        supabase.from("monthly_incomes").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
      ]);
    } catch (err) {
      reportFailure(err);
      setLoading(false);
      return;
    }

    if (sourcesResult.error || monthlyResult.error) {
      reportFailure(sourcesResult.error || monthlyResult.error);
      setLoading(false);
      return;
    }
    reportSuccess();

    const { data: sourcesData } = sourcesResult;
    const { data: monthlyData } = monthlyResult;

    // Decrypt sensitive fields (if encrypted)
    const decryptedSources = await decryptSources(sourcesData || []);
    const decryptedMonthly = await decryptIncomes(monthlyData || []);

    setIncomeSources(decryptedSources);

    // Separate regular incomes (filter out one-time incomes which have no source)
    const regularIncomes = decryptedMonthly.filter((m: any) => m.income_source_id !== null);

    setMonthlyIncomes(regularIncomes);

    // Seed missing rows for the current financial month only, with
    // budget_snapshot = source.budget. Past months stay read-only.
    if (fetchMonth === todayMonth && user) {
      const missingSources = decryptedSources.filter((source: any) =>
        !decryptedMonthly.find((m: any) => m.income_source_id === source.id)
      );
      if (missingSources.length > 0) {
        const records = missingSources.map((source: any) => ({
          income_source_id: source.id,
          household_id: household.id,
          month: fetchMonth,
          month_start: startStr,
          month_end: endStr,
          budget_snapshot: parseFloat((source.budget || "0").toString()),
          created_by: user.id,
        }));
        const encrypted = await Promise.all(records.map(r => encryptIncome(r)));
        await supabase.from("monthly_incomes").upsert(encrypted, {
          onConflict: "income_source_id,month",
          ignoreDuplicates: true,
        });
      }
    }

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.id, financialMonthStart, selectedMonth, user?.id, isUnlocked]);

  useEffect(() => {
    if (!householdLoading && household?.id) {
      fetchData();
    }
  }, [householdLoading, household?.id, fetchData]);

  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<any | null>(null);
  const handleEditSource = (source: any) => {
    setEditingSource(source);
    setSourceDialogOpen(true);
  };

  // Effective amount per source for display + totals.
  // Precedence: confirmed actual > frozen snapshot > current source.budget.
  const amountFor = (source: any): number => {
    const monthly = monthlyIncomes.find((m: any) => m.income_source_id === source.id);
    if (monthly?.actual_amount != null) return Number(monthly.actual_amount);
    if (monthly?.budget_snapshot != null) return Number(monthly.budget_snapshot);
    return parseFloat((source.budget || "0").toString());
  };

  const totalIncome = incomeSources.reduce((sum, s) => sum + amountFor(s), 0);
  const currencyCode = household?.currency || "SEK";
  const activeSourceCount = incomeSources.filter((s: any) => {
    if (s.is_active === false) return false;
    return amountFor(s) > 0;
  }).length;

  // Header — month nav hidden when there's no data to navigate (locked state).
  const monthEndDate = getFinancialMonthRange(selectedMonth, financialMonthStart).end;
  const monthLabel = format(monthEndDate, "MMM yyyy");
  const atEarliestMonth = !!earliestDataMonth && selectedMonth <= earliestDataMonth;
  const renderHeader = (showMonthNav: boolean, isLoading = false) => (
    <div className="flex items-center justify-between gap-4 min-h-9">
      <h1>Income</h1>
      <div className="flex items-center gap-2">
        {isLoading ? (
          <div className="flex items-center gap-1">
            <Skeleton className="h-9 w-9 rounded-[12px]" />
            <Skeleton className="h-9 w-32 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-[12px]" />
          </div>
        ) : (
          <div className={`flex items-center gap-1 ${showMonthNav ? '' : 'invisible'}`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              disabled={!showMonthNav || atEarliestMonth}
              onClick={() => setSelectedMonth(getPreviousFinancialMonth(selectedMonth, financialMonthStart))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <MonthPickerPopover
              selectedMonth={selectedMonth}
              financialMonthStart={financialMonthStart}
              onSelect={setSelectedMonth}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              disabled={!showMonthNav}
              onClick={() => setSelectedMonth(getNextFinancialMonth(selectedMonth, financialMonthStart))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="md:hidden">
          <UserMenu trigger={<AvatarTrigger />} />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-5">
        {renderHeader(false, true)}
        <IncomePageSkeleton />
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

  const hasAnySource = incomeSources.length > 0;

  return (
    <div className={`space-y-5 ${mobileBottomBarSpacer}`}>
      {renderHeader(hasAnySource)}

      {hasAnySource && (
        <Card>
          <p className="text-xs font-medium text-muted tracking-wide">
            Total income per month
          </p>
          <div className="mt-1">
            <Money
              v={totalIncome}
              currency={currencyCode}
              size="4xl"
              weight={600}
              color="accent"
              className="tracking-tighter"
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            {activeSourceCount} active {activeSourceCount === 1 ? "source" : "sources"} · {fmtKr(totalIncome * 12, currencyCode)} per year
          </p>
          {activeSourceCount > 0 && (
            <button
              type="button"
              onClick={handleViewPrognosis}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-dk hover:underline focus:outline-none focus-visible:underline"
            >
              <Calculator className="h-3.5 w-3.5" />
              View annual tax prognosis
            </button>
          )}
        </Card>
      )}

      {isReadOnly && hasAnySource && (
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

      {hasAnySource && (
        <div className="hidden sm:grid grid-cols-2 gap-5">
          <Button
            size="lg"
            disabled={isReadOnly}
            className="w-full justify-center gap-2"
            onClick={() => { if (!isReadOnly) { setEditingSource(null); setSourceDialogOpen(true); } }}
          >
            <Plus className="h-4 w-4" />
            Add source
          </Button>
          {!isReadOnly && <OneTimeIncomeDialog householdId={household.id} onSuccess={fetchData} />}
        </div>
      )}

      {!hasAnySource ? (
        <EmptyStateCard
          icon={HandCoins}
          iconClassName="text-accent"
          headline="No income sources yet"
          description="Add your salary, CSN, or any other recurring income."
          primaryLabel="Add your first source"
          onPrimary={() => { setEditingSource(null); setSourceDialogOpen(true); }}
        />
      ) : (
        <Card variant="flush">
          <div className="flex items-center gap-3 px-4 py-4 sm:px-5 border-b border-line-2">
            <span className="flex items-baseline gap-2 min-w-0">
              <span className="font-medium text-ink">Income</span>
              <span className="text-xs text-muted tabular-nums">{activeSourceCount}</span>
            </span>
          </div>

          <div>
            {incomeSources.map((source, idx) => {
              const monthly = monthlyIncomes.find((m: any) => m.income_source_id === source.id);
              const rawActual = monthly?.actual_amount;
              const actualAmount = rawActual !== undefined && rawActual !== null
                ? Number(rawActual)
                : undefined;

              return (
                <IncomeSourceItem
                  key={source.id}
                  source={source}
                  amount={amountFor(source)}
                  actualAmount={actualAmount}
                  currency={household?.currency || "SEK"}
                  onEdit={handleEditSource}
                  readOnly={isReadOnly}
                  last={idx === incomeSources.length - 1}
                />
              );
            })}
          </div>
        </Card>
      )}

      {hasAnySource && (
        <MobileBottomBar>
          <Button
            size="lg"
            disabled={isReadOnly}
            className="w-full justify-center gap-2"
            onClick={() => { if (!isReadOnly) { setEditingSource(null); setSourceDialogOpen(true); } }}
          >
            <Plus className="h-4 w-4" />
            Add source
          </Button>
          {!isReadOnly && <OneTimeIncomeDialog householdId={household.id} onSuccess={fetchData} />}
        </MobileBottomBar>
      )}

      <TaxPrognosisModal
        open={prognosisOpen}
        onOpenChange={setPrognosisOpen}
        prognosis={prognosis}
        loading={prognosisLoading}
      />

      {household && (
        <IncomeFormDialog
          open={sourceDialogOpen}
          onOpenChange={(v) => {
            setSourceDialogOpen(v);
            if (!v) setEditingSource(null);
          }}
          mode={editingSource ? "edit" : "add"}
          householdId={household.id}
          members={members}
          coParents={coParents}
          financialMonthStart={financialMonthStart}
          initialValues={editingSource ? {
            id: editingSource.id,
            category: editingSource.category,
            name: editingSource.name,
            provider: editingSource.provider,
            owner_id: editingSource.owner_id,
            budget: editingSource.budget,
            is_shared: editingSource.is_shared,
            co_parent_id: editingSource.co_parent_id,
            share_percentage: editingSource.share_percentage,
            tax_type: editingSource.tax_type,
            custom_tax_rate: editingSource.custom_tax_rate,
            is_active: editingSource.is_active,
          } : undefined}
          onSuccess={fetchData}
        />
      )}
    </div >
  );
};

export default Income;