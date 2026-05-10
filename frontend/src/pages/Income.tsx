import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { AddButton } from "@/components/ui/add-button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, ClipboardCheck, Check, ChevronLeft, ChevronRight, Plus, Calculator } from "lucide-react";
import { Alert, AlertContent, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { MonthChip } from "@/components/ui/month-chip";
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
import { fetchHistoryByKey } from "@/utils/carryForward";
import { computeSmartDefault } from "@/services/smartDefaults";
import { reportSuccess, reportFailure, isDown } from "@/utils/outageMonitor";
import { useMonthlyReviewStatus } from "@/components/dashboard/MonthlyReviewWizard";

import { IncomePageSkeleton } from "@/components/shared/skeletons/PageSkeletons";
import { EmptyStateCard } from "@/components/shared/EmptyStateCard";
import { useEncryptedFields, incomeSourceFields, monthlyIncomeFields } from "@/hooks/useEncryptedFields";

import { VaultLockedAlert } from "@/components/shared/VaultLockedAlert";
import { useEncryption } from "@/contexts/EncryptionContext";

const Income = () => {
  const { user } = useAuth();
  const { isUnlocked } = useEncryption();
  const { household, members, coParents, financialMonthStart, loading: householdLoading } = useHousehold();
  const location = useLocation(); // Trigger refetch on navigation
  const { toast } = useToast();
  const [incomeSources, setIncomeSources] = useState<any[]>([]);
  const [monthlyIncomes, setMonthlyIncomes] = useState<any[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
          gross_monthly: parseFloat(amounts[s.id] || s.default_amount || "0") || 0,
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

  // Autosave state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const amountsRef = useRef<Record<string, string>>({}); // Track latest amounts for autosave

  // Keep these for display/header purposes only (will update on re-render)
  const currentMonth = selectedMonth;
  const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth, financialMonthStart);

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

    // Carry-forward: find most recent record per source (from any month before this one)
    const missingSources = decryptedSources.filter((source: any) =>
      !decryptedMonthly.find((m: any) => m.income_source_id === source.id)
    );

    const historyBySource = await fetchHistoryByKey({
      table: "monthly_incomes",
      keyField: "income_source_id",
      keys: missingSources.map((s: any) => s.id),
      householdId: household.id,
      beforeMonth: fetchMonth,
      decrypt: decryptIncomes,
    });

    // Auto-create monthly_incomes records for sources that don't have them yet.
    // Smart defaults: stable history → last month; variable → 3-month avg;
    // no history → fall back to source default.
    const missingRecords: any[] = [];
    missingSources.forEach((source: any) => {
      if (!user) return;
      const history = historyBySource.get(source.id) ?? [];
      const smart = computeSmartDefault(history);
      const amount = smart.source != null
        ? smart.value
        : parseFloat((source.default_amount || "0").toString());
      missingRecords.push({
        income_source_id: source.id,
        household_id: household.id,
        month: fetchMonth,
        month_start: startStr,
        month_end: endStr,
        budget_amount: amount,
        created_by: user.id,
      });
    });

    // Create missing records in batch if any (encrypted)
    if (missingRecords.length > 0) {
      const encryptedRecords = await Promise.all(
        missingRecords.map(record => encryptIncome(record))
      );
      // Use upsert with ignoreDuplicates so concurrent fetchData runs (e.g.
      // React strict-mode double effects, or rapid navigation) don't 409.
      await supabase.from("monthly_incomes").upsert(encryptedRecords, {
        onConflict: "income_source_id,month",
        ignoreDuplicates: true,
      });
    }

    // Note: Don't set 'saved' status on initial load - only after actual user edits

    const initialAmounts: Record<string, string> = {};
    decryptedSources.forEach((source: any) => {
      const existing = decryptedMonthly.find((m: any) => m.income_source_id === source.id);
      if (existing) {
        const value = existing.actual_amount ?? existing.budget_amount ?? existing.amount ?? 0;
        initialAmounts[source.id] = value.toString();
      } else {
        const missing = missingRecords.find((r: any) => r.income_source_id === source.id);
        initialAmounts[source.id] = missing
          ? missing.budget_amount.toString()
          : (source.default_amount || "0").toString();
      }
    });
    setAmounts(initialAmounts);
    amountsRef.current = initialAmounts; // Sync ref with initial amounts
    setLoading(false);
  }, [household?.id, financialMonthStart, selectedMonth, user, isUnlocked]);

  useEffect(() => {
    if (!householdLoading && household?.id) {
      fetchData();
    }
  }, [householdLoading, fetchData, location.key]); // location.key changes on each navigation

  // Smart Defaults backend call removed — the service was disabled during
  // the encryption migration and never restored. Client-side carry-forward
  // (above, in fetchData) now handles seeding amounts from the most recent
  // month with data, which is more useful anyway.

  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<any | null>(null);
  const handleEditSource = (source: any) => {
    setEditingSource(source);
    setSourceDialogOpen(true);
  };


  // Handle amount change - track modifications and trigger autosave
  const handleAmountChange = (sourceId: string, value: string) => {
    if (isReadOnly) return;
    const newAmounts = { ...amounts, [sourceId]: value };
    setAmounts(newAmounts);
    amountsRef.current = newAmounts; // Keep ref in sync for autosave

    // Trigger debounced autosave
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setAutoSaveStatus('idle'); // Show as pending
    autoSaveTimerRef.current = setTimeout(() => {
      if (household && user && incomeSources.length > 0) {
        handleSave();
      }
    }, 500); // 500ms debounce
  };



  const handleSave = useCallback(async () => {
    if (!household || !user) return;
    setSaving(true);
    setAutoSaveStatus('saving');

    // Use amountsRef to get the latest amounts value
    const currentAmounts = amountsRef.current;

    // Use the selected month for saving
    const saveMonth = selectedMonth;
    const { start: saveStart, end: saveEnd } = getFinancialMonthRange(saveMonth, financialMonthStart);

    // Build entries and encrypt them
    const entries = await Promise.all(incomeSources.map(async (source) => {
      const baseEntry = {
        income_source_id: source.id,
        household_id: household.id,
        month: saveMonth,
        month_start: format(saveStart, "yyyy-MM-dd"),
        month_end: format(saveEnd, "yyyy-MM-dd"),
        budget_amount: parseFloat(currentAmounts[source.id] || "0"),
        created_by: user.id,
      };
      // Encrypt the entry (encrypts amount field)
      return await encryptIncome(baseEntry);
    }));

    const { error } = await supabase
      .from("monthly_incomes")
      .upsert(entries as any, { onConflict: "income_source_id,month" });

    if (error) {
      setAutoSaveStatus('error');
      toast({
        title: "Error",
        description: "Failed to save income data",
        variant: "destructive",
      });
    } else {
      setAutoSaveStatus('saved');
      // Don't show toast for autosave - only show brief status indicator
    }
    setSaving(false);
  }, [household, user, incomeSources, financialMonthStart, toast, encryptIncome]);

  const handleAddOneTime = async (data: {
    name: string;
    amount: string;
    notes: string;
    isShared: boolean;
    coParentId: string;
    sharePercentage: string;
  }) => {
    if (!household || !user || !data.name || !data.amount) {
      toast({
        title: "Error",
        description: "Name and amount are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("monthly_incomes")
      .insert({
        household_id: household.id,
        month: currentMonth,
        amount: parseFloat(data.amount),
        one_time_name: data.name,
        notes: data.notes || null,
        is_shared: data.isShared,
        co_parent_id: data.isShared ? data.coParentId : null,
        share_percentage: data.isShared ? parseFloat(data.sharePercentage) : 50,
        created_by: user.id,
        income_source_id: null,
      } as any);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add one-time income",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "One-time income added",
      });
      fetchData();
    }
    setSaving(false);
  };

  const handleDeleteOneTime = async (id: string) => {
    const { error } = await supabase
      .from("monthly_incomes")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete one-time income",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "One-time income deleted",
      });
      fetchData();
    }
  };

  const totalIncome = Object.values(amounts).reduce((sum, val) => sum + parseFloat(val || "0"), 0);
  const currencyCode = household?.currency || "SEK";
  const activeSourceCount = incomeSources.filter(s => s.is_active !== false).length;

  // Header — month nav hidden when there's no data to navigate (locked state).
  const monthEndDate = getFinancialMonthRange(selectedMonth, financialMonthStart).end;
  const monthLabel = format(monthEndDate, "MMM yyyy");
  const renderHeader = (showMonthNav: boolean) => (
    <div className="flex items-center justify-between gap-4">
      <h1>Income</h1>
      {showMonthNav && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setSelectedMonth(getPreviousFinancialMonth(selectedMonth, financialMonthStart))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <MonthChip value={monthLabel} />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setSelectedMonth(getNextFinancialMonth(selectedMonth, financialMonthStart))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-5">
        {renderHeader(false)}
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
    <div className="space-y-5">
      {renderHeader(hasAnySource)}

      {hasAnySource && (
        <Card>
          <p className="text-xs font-medium text-muted-foreground tracking-wide">
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
          <p className="mt-1 text-xs text-muted-foreground">
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
              Edits are locked until the Monthly Review is complete. Use the wizard on the Dashboard to review and finalize.
            </AlertDescription>
          </AlertContent>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/">Open Review</Link>
          </Button>
        </Alert>
      )}

      {hasAnySource && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
          {(autoSaveStatus === 'saved' || autoSaveStatus === 'error') && (
            <div className="flex justify-end">
              {autoSaveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-sm text-accent animate-in fade-in duration-150">
                  <Check className="h-4 w-4" /> Saved
                </span>
              )}
              {autoSaveStatus === 'error' && (
                <span className="text-sm text-destructive">Failed to save</span>
              )}
            </div>
          )}
        </div>
      )}

      {!hasAnySource ? (
        <EmptyStateCard
          icon={TrendingUp}
          iconClassName="text-success"
          headline="No income sources yet"
          description="Add your salary, CSN, or any other recurring income."
          primaryLabel="Add your first source"
          onPrimary={() => { setEditingSource(null); setSourceDialogOpen(true); }}
        />
      ) : (
        <Card variant="flush">
          {/* Block Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-line-2">
            <TrendingUp className="h-5 w-5 text-success" />
            <div>
              <h3>Income</h3>
              <p className="text-xs text-muted-foreground">
                {incomeSources.length} {incomeSources.length === 1 ? 'source' : 'sources'}
              </p>
            </div>
          </div>

          {/* Income Sources List — flush rows with dividers */}
          <div>
            {incomeSources.map((source, idx) => {
              const currentAmount = amounts[source.id];
              let status: 'saved' | 'modified' | 'none' = 'none';
              if (currentAmount !== undefined) {
                const defaultStr = (source.default_amount || 0).toString();
                status = currentAmount === defaultStr ? 'saved' : 'modified';
              }

              const monthly = monthlyIncomes.find((m: any) => m.income_source_id === source.id);
              const rawActual = monthly?.actual_amount;
              const actualAmount = rawActual !== undefined && rawActual !== null
                ? Number(rawActual)
                : undefined;

              return (
                <IncomeSourceItem
                  key={source.id}
                  source={source}
                  amount={amounts[source.id] || (source.default_amount || "0").toString()}
                  actualAmount={actualAmount}
                  currency={household?.currency || "SEK"}
                  onAmountChange={handleAmountChange}
                  onEdit={handleEditSource}
                  onDelete={() => {}}
                  status={status}
                  readOnly={isReadOnly}
                  last={idx === incomeSources.length - 1}
                />
              );
            })}
          </div>
        </Card>
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
            owner_id: editingSource.created_by ?? editingSource.owner_id,
            default_amount: editingSource.default_amount,
            is_shared: editingSource.is_shared,
            co_parent_id: editingSource.co_parent_id,
            share_percentage: editingSource.share_percentage,
          } : undefined}
          onSuccess={fetchData}
        />
      )}
    </div >
  );
};

export default Income;