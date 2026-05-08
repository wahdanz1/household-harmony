import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { AddButton } from "@/components/ui/add-button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, AlertCircle, ClipboardCheck } from "lucide-react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { IncomeSourceItem } from "@/components/income/IncomeSourceItem";
import { IncomeSourceDialog } from "@/components/income/IncomeSourceDialog";
import { OneTimeIncomeDialog } from "@/components/income/OneTimeIncomeDialog";

import { useIncomeSources } from "@/components/income/hooks/useIncomeSources";
import { getCurrentFinancialMonth, getFinancialMonthRange, getPreviousFinancialMonth, getNextFinancialMonth } from "@/utils/dateUtils";
import { fetchMostRecentByKey } from "@/utils/carryForward";
import { reportSuccess, reportFailure, isDown } from "@/utils/outageMonitor";
import { useMonthlyReviewStatus } from "@/components/dashboard/MonthlyReviewWizard";

import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState, LoadingState } from "@/components/shared/states";
import { fetchIncomeSuggestions, getSuggestionBorderColor } from "@/services/smartDefaults";

import { useEncryptedFields, incomeSourceFields, monthlyIncomeFields } from "@/hooks/useEncryptedFields";

import type { IncomeSuggestion } from "@/types/api";

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


  // Auto-fill state
  const [suggestions, setSuggestions] = useState<IncomeSuggestion[]>([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());

  // Month navigation state
  const todayMonth = getCurrentFinancialMonth(financialMonthStart);
  const [selectedMonth, setSelectedMonth] = useState(todayMonth);
  const isCurrentMonth = selectedMonth === todayMonth;

  // Monthly review gate: editing the current month is locked until the
  // review for that month has been finalized. Past/future months stay editable.
  const { needsReview, latestFinalizedMonth } = useMonthlyReviewStatus(household?.id, financialMonthStart);
  const isReadOnly = isCurrentMonth && needsReview;
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
  const hasAutoFilledRef = useRef(false);
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

    const mostRecentBySource = await fetchMostRecentByKey({
      table: "monthly_incomes",
      keyField: "income_source_id",
      keys: missingSources.map((s: any) => s.id),
      householdId: household.id,
      beforeMonth: fetchMonth,
      decrypt: decryptIncomes,
    });

    // Auto-create monthly_incomes records for sources that don't have them yet
    // Carry forward from most recent actual values, fall back to source default
    const missingRecords: any[] = [];
    missingSources.forEach((source: any) => {
      if (!user) return;
      const prevRecord = mostRecentBySource.get(source.id);
      const amount = prevRecord
        ? parseFloat((prevRecord.amount || "0").toString())
        : parseFloat((source.default_amount || "0").toString());
      missingRecords.push({
        income_source_id: source.id,
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
        missingRecords.map(record => encryptIncome(record))
      );
      await supabase.from("monthly_incomes").insert(encryptedRecords);
    }

    // Note: Don't set 'saved' status on initial load - only after actual user edits

    const initialAmounts: Record<string, string> = {};
    decryptedSources.forEach((source: any) => {
      const existing = decryptedMonthly.find((m: any) => m.income_source_id === source.id);
      if (existing) {
        initialAmounts[source.id] = (existing.amount || "0").toString();
      } else {
        // Use the carry-forward amount from missingRecords
        const missing = missingRecords.find((r: any) => r.income_source_id === source.id);
        initialAmounts[source.id] = missing ? missing.amount.toString() : (source.default_amount || "0").toString();
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

  // Auto-fill on page load when no saved income for current month
  useEffect(() => {
    // Only auto-fill once, when we have data loaded and no saved income
    if (
      !loading &&
      !hasAutoFilledRef.current &&
      household?.id &&
      incomeSources.length > 0 &&
      monthlyIncomes.length === 0 // No saved income for current month
    ) {
      hasAutoFilledRef.current = true;
      handleAutoFill(true);
    }
  }, [loading, household?.id, incomeSources.length, monthlyIncomes.length]);

  const {
    sourceDialogOpen,
    setSourceDialogOpen,
    editingSourceId,
    sourceFormData,
    setSourceFormData,
    handleEditSource,
    handleSaveSource,
    handleDeleteSource,
    resetSourceForm,
  } = useIncomeSources(household?.id || "", members, fetchData);

  // Auto-fill handler - fetches suggestions from backend
  const handleAutoFill = async (showToast = true) => {
    if (!household?.id || !incomeSources.length) return;

    try {
      const incomeSuggestions = await fetchIncomeSuggestions(household.id);
      if (!incomeSuggestions || incomeSuggestions.length === 0) return;

      setSuggestions(incomeSuggestions);

      // Apply suggestions to form
      const newAmounts = { ...amounts };
      const newApplied = new Set<string>();

      incomeSuggestions.forEach((suggestion) => {
        const source = incomeSources.find(s => s.id === suggestion.income_source_id);
        if (source) {
          newAmounts[suggestion.income_source_id] = suggestion.suggested_amount.toString();
          newApplied.add(suggestion.income_source_id);
        }
      });

      setAmounts(newAmounts);
      setAppliedSuggestions(newApplied);

      if (showToast && incomeSuggestions.length > 0) {
        toast({
          title: "Smart defaults applied",
          description: `Pre-filled ${incomeSuggestions.length} income sources from historical data`,
        });
      }
    } catch (error) {
      console.error('Auto-fill failed:', error);
      // Silently fail - user can still enter amounts manually
    }
  };

  // Get border color for an income source input
  const getBorderClass = (sourceId: string): string => {
    const suggestion = suggestions.find(s => s.income_source_id === sourceId);
    if (!suggestion) return '';

    // Check if user modified the suggestion
    const originalSuggestion = suggestion.suggested_amount.toString();
    const currentValue = amounts[sourceId];

    if (appliedSuggestions.has(sourceId) && currentValue !== originalSuggestion) {
      return getSuggestionBorderColor('user_modified');
    }

    return getSuggestionBorderColor(suggestion.source);
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
        amount: parseFloat(currentAmounts[source.id] || "0"),
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

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Income Management" />
        <LoadingState />
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="space-y-4">
        <PageHeader title="Income Management" />
        <VaultLockedAlert />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Income Management"
        totalLabel="Total Income"
        totalAmount={totalIncome}
        showSmartDefaults={suggestions.length > 0}
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

      {/* Add Source Button - matching Expenses style */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Dialog open={sourceDialogOpen} onOpenChange={(open) => {
            if (isReadOnly) return;
            setSourceDialogOpen(open);
            if (!open) resetSourceForm();
          }}>
            <DialogTrigger asChild>
              <AddButton disabled={isReadOnly}>Add Source</AddButton>
            </DialogTrigger>
            <IncomeSourceDialog
              open={sourceDialogOpen}
              editingSourceId={editingSourceId}
              sourceFormData={sourceFormData}
              members={members}
              coParents={coParents}
              onOpenChange={(open) => {
                setSourceDialogOpen(open);
                if (!open) resetSourceForm();
              }}
              onFormDataChange={setSourceFormData}
              onSave={handleSaveSource}
              onDelete={editingSourceId ? () => handleDeleteSource(editingSourceId) : undefined}
            />
          </Dialog>
          {!isReadOnly && <OneTimeIncomeDialog householdId={household.id} onSuccess={fetchData} />}
        </div>
        {/* Saved indicator - right aligned */}
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

      {/* Monthly Income Block */}
      <Card className="overflow-hidden">
        {/* Block Header */}
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-green-500" />
          <div>
            <h3>Income</h3>
            <p className="text-xs text-muted-foreground">
              {incomeSources.length} {incomeSources.length === 1 ? 'source' : 'sources'}
            </p>
          </div>
        </div>

        {/* Income Sources List */}
        {incomeSources.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={AlertCircle}
              title="No income sources configured"
              description='Click "Add Source" to get started'
            />
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {incomeSources.map((source) => {
              const currentAmount = amounts[source.id];

              // Status: green = using default, lime = manually overridden
              let status: 'saved' | 'modified' | 'none' = 'none';
              if (currentAmount !== undefined) {
                const defaultStr = (source.default_amount || 0).toString();
                status = currentAmount === defaultStr ? 'saved' : 'modified';
              }

              return (
                <IncomeSourceItem
                  key={source.id}
                  source={source}
                  amount={amounts[source.id] || (source.default_amount || "0").toString()}
                  currency={household?.currency || "SEK"}
                  onAmountChange={handleAmountChange}
                  onEdit={handleEditSource}
                  onDelete={handleDeleteSource}
                  status={status}
                  readOnly={isReadOnly}
                />
              );
            })}
          </div>
        )}
      </Card>



      {/* Total Monthly Income Bar - matching Expenses style with border */}
      <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Total Monthly Income</span>
          <span className="text-2xl font-bold text-green-500">
            {totalIncome.toFixed(0)} {household?.currency || "SEK"}
          </span>
        </div>
      </div>

    </div >
  );
};

export default Income;