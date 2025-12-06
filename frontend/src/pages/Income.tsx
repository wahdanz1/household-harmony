import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, AlertCircle, Plus, Check, Loader2 } from "lucide-react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { IncomeSourceItem } from "@/components/income/IncomeSourceItem";
import { IncomeSourceDialog } from "@/components/income/IncomeSourceDialog";
import { OneTimeIncomeCard } from "@/components/income/OneTimeIncomeCard";
import { useIncomeSources } from "@/components/income/hooks/useIncomeSources";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
import { TaxSummaryCard } from "@/components/income/TaxSummaryCard";
import { TaxPrognosisModal } from "@/components/income/TaxPrognosisModal";
import { PageHeader } from "@/components/shared/PageHeader";
import { fetchIncomeSuggestions, getSuggestionBorderColor } from "@/services/smartDefaults";
import { getTaxPrognosis } from "@/services/tax";
import type { IncomeSuggestion, IncomeForTax, TaxPrognosisResult } from "@/types/api";

const Income = () => {
  const { user } = useAuth();
  const { household, members, coParents, financialMonthStart, loading: householdLoading } = useHousehold();
  const location = useLocation(); // Trigger refetch on navigation
  const { toast } = useToast();
  const [incomeSources, setIncomeSources] = useState<any[]>([]);
  const [monthlyIncomes, setMonthlyIncomes] = useState<any[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [oneTimeIncomes, setOneTimeIncomes] = useState<any[]>([]);

  // Auto-fill and tax state
  const [suggestions, setSuggestions] = useState<IncomeSuggestion[]>([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [prognosisModalOpen, setPrognosisModalOpen] = useState(false);
  const [prognosis, setPrognosis] = useState<TaxPrognosisResult | null>(null);
  const [prognosisLoading, setPrognosisLoading] = useState(false);

  // Autosave state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoFilledRef = useRef(false);
  const amountsRef = useRef<Record<string, string>>({}); // Track latest amounts for autosave

  // Keep these for display/header purposes only (will update on re-render)
  const currentMonth = getCurrentFinancialMonth(financialMonthStart);
  const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth, financialMonthStart);

  const fetchData = useCallback(async () => {
    if (!household?.id) return;

    // Compute dates fresh inside fetchData using current financialMonthStart
    const fetchMonth = getCurrentFinancialMonth(financialMonthStart);
    const { start: fetchStart, end: fetchEnd } = getFinancialMonthRange(fetchMonth, financialMonthStart);
    const startStr = format(fetchStart, "yyyy-MM-dd");
    const endStr = format(fetchEnd, "yyyy-MM-dd");

    const [
      { data: sourcesData },
      { data: monthlyData },
    ] = await Promise.all([
      supabase.from("income_sources").select("*, profiles(full_name, avatar_url)").eq("household_id", household.id).eq("is_active", true).order("created_at", { ascending: true }),
      supabase.from("monthly_incomes").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
    ]);

    setIncomeSources(sourcesData || []);

    // Separate regular incomes and one-time incomes
    const regularIncomes = (monthlyData || []).filter((m: any) => m.income_source_id !== null);
    const oneTimeIncomesData = (monthlyData || []).filter((m: any) => m.income_source_id === null);


    setMonthlyIncomes(regularIncomes);
    setOneTimeIncomes(oneTimeIncomesData);

    // Auto-create monthly_incomes records for sources that don't have them yet
    // This ensures Dashboard shows all income, not just edited sources
    const missingRecords: any[] = [];
    (sourcesData || []).forEach((source: any) => {
      const existing = (monthlyData || []).find((m: any) => m.income_source_id === source.id);
      if (!existing && user) {
        missingRecords.push({
          income_source_id: source.id,
          household_id: household.id,
          month: fetchMonth,
          month_start: startStr,
          month_end: endStr,
          amount: parseFloat(source.default_amount?.toString() || "0"),
          created_by: user.id,
        });
      }
    });

    // Create missing records in batch if any
    if (missingRecords.length > 0) {
      await supabase.from("monthly_incomes").insert(missingRecords);
    }

    // Set autosave status based on existing data
    if (regularIncomes.length > 0 || missingRecords.length > 0) {
      setAutoSaveStatus('saved');
    } else {
      setAutoSaveStatus('idle');
    }

    const initialAmounts: Record<string, string> = {};
    (sourcesData || []).forEach((source: any) => {
      const existing = (monthlyData || []).find((m: any) => m.income_source_id === source.id);
      initialAmounts[source.id] = existing ? existing.amount.toString() : source.default_amount.toString();
    });
    setAmounts(initialAmounts);
    amountsRef.current = initialAmounts; // Sync ref with initial amounts
    setLoading(false);
  }, [household?.id, financialMonthStart, user]);

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
      if (incomeSuggestions.length === 0) return;

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
          title: "✨ Smart defaults applied",
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

  // Fetch tax prognosis
  const handleViewPrognosis = async () => {
    setPrognosisModalOpen(true);
    setPrognosisLoading(true);

    try {
      const incomeData: IncomeForTax[] = incomeSources.map(source => ({
        gross_monthly: parseFloat(amounts[source.id] || '0'),
        tax_type: source.tax_type || 'progressive',
        custom_rate: source.custom_tax_rate,
      }));

      const result = await getTaxPrognosis(incomeData);
      setPrognosis(result);
    } catch (error) {
      console.error('Failed to fetch prognosis:', error);
      toast({
        title: "Prognosis unavailable",
        description: "Could not calculate tax prognosis",
        variant: "destructive",
      });
    } finally {
      setPrognosisLoading(false);
    }
  };

  // Calculate estimated tax (simplified for display)
  const calculateEstimatedTax = (): { gross: number; tax: number; net: number; rate: number } => {
    const gross = Object.values(amounts).reduce((sum, val) => sum + parseFloat(val || "0"), 0);
    // Simplified tax estimate - 30% average for display
    const estimatedRate = 0.30;
    const tax = gross * estimatedRate;
    const net = gross - tax;
    return { gross, tax, net, rate: estimatedRate * 100 };
  };

  const handleSave = useCallback(async () => {
    if (!household || !user) return;
    setSaving(true);
    setAutoSaveStatus('saving');

    // Use amountsRef to get the latest amounts value
    const currentAmounts = amountsRef.current;

    // Compute dates fresh at save time
    const saveMonth = getCurrentFinancialMonth(financialMonthStart);
    const { start: saveStart, end: saveEnd } = getFinancialMonthRange(saveMonth, financialMonthStart);

    const entries = incomeSources.map((source) => ({
      income_source_id: source.id,
      household_id: household.id,
      month: saveMonth,
      month_start: format(saveStart, "yyyy-MM-dd"),
      month_end: format(saveEnd, "yyyy-MM-dd"),
      amount: parseFloat(currentAmounts[source.id] || "0"),
      created_by: user.id,
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
  }, [household, user, incomeSources, financialMonthStart, toast]);

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

  const totalIncome = Object.values(amounts).reduce((sum, val) => sum + parseFloat(val || "0"), 0) +
    oneTimeIncomes.reduce((sum, income) => {
      const amount = parseFloat(income.amount || "0");
      // If shared, only count your portion
      if (income.is_shared && income.share_percentage) {
        return sum + (amount * (parseFloat(income.share_percentage.toString()) / 100));
      }
      return sum + amount;
    }, 0);

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
        title="Income Management"
        totalLabel="Total Income"
        totalAmount={totalIncome}
        showSmartDefaults={suggestions.length > 0}
      />

      {/* Unified Income Management */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                Monthly Income
              </CardTitle>
              <CardDescription className="mt-1.5">
                Values are pre-filled from previous months and save automatically as you type. Toggle off any income not received this month.
              </CardDescription>
            </div>
            <Dialog open={sourceDialogOpen} onOpenChange={(open) => {
              setSourceDialogOpen(open);
              if (!open) resetSourceForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Source
                </Button>
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
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {incomeSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
              <p>No income sources configured</p>
              <p className="text-sm">Add income sources above to get started</p>
            </div>
          ) : (
            <>
              {/* Status Bar: shows autosave status on the right */}
              <div className="flex items-center justify-between text-xs pb-2 border-b border-border mb-2">
                <span className="text-muted-foreground">
                  <span className="hidden sm:inline">Click</span>
                  <span className="sm:hidden">Tap</span>
                  {" "}an item to edit details
                </span>
                <div className="flex items-center gap-2">
                  {autoSaveStatus === 'saving' && (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </span>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <span className="flex items-center gap-1.5 text-green-600 animate-in fade-in slide-in-from-right-2 duration-300">
                      <Check className="h-3.5 w-3.5" />
                      <span className="inline-flex">
                        {'Saved'.split('').map((letter, i) => (
                          <span
                            key={i}
                            className="animate-in fade-in duration-150"
                            style={{ animationDelay: `${i * 50}ms` }}
                          >
                            {letter}
                          </span>
                        ))}
                      </span>
                    </span>
                  )}
                  {autoSaveStatus === 'error' && (
                    <span className="flex items-center gap-1.5 text-red-500">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Error
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {incomeSources.map((source) => {
                  const currentAmount = amounts[source.id];

                  // Find the smart suggestion for this source
                  const suggestion = suggestions.find(s => s.income_source_id === source.id);
                  const suggestedAmount = suggestion?.suggested_amount?.toString() || source.default_amount.toString();

                  // Status: green = using default/smart default, lime = manually overridden
                  // Always calculate status by comparing with default, like Expenses page
                  let status: 'saved' | 'modified' | 'none' = 'none';
                  if (currentAmount !== undefined) {
                    status = currentAmount === source.default_amount.toString() ? 'saved' : 'modified';
                  }

                  return (
                    <IncomeSourceItem
                      key={source.id}
                      source={source}
                      amount={amounts[source.id] || source.default_amount.toString()}
                      currency={household?.currency || "SEK"}
                      onAmountChange={handleAmountChange}
                      onEdit={handleEditSource}
                      onDelete={handleDeleteSource}
                      status={status}
                    />
                  );
                })}
              </div>

              {/* Tax Summary Card */}
              {incomeSources.length > 0 && (
                <div className="mt-4">
                  <TaxSummaryCard
                    grossIncome={calculateEstimatedTax().gross}
                    estimatedTax={calculateEstimatedTax().tax}
                    netIncome={calculateEstimatedTax().net}
                    effectiveRate={calculateEstimatedTax().rate}
                    onViewPrognosis={handleViewPrognosis}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <OneTimeIncomeCard
        oneTimeIncomes={oneTimeIncomes}
        currency={household?.currency || "SEK"}
        coParents={coParents}
        saving={saving}
        onAdd={handleAddOneTime}
        onDelete={handleDeleteOneTime}
      />

      {/* Tax Prognosis Modal */}
      <TaxPrognosisModal
        open={prognosisModalOpen}
        onOpenChange={setPrognosisModalOpen}
        prognosis={prognosis}
        loading={prognosisLoading}
      />
    </div>
  );
};

export default Income;