import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, AlertCircle, Plus, Check } from "lucide-react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveHousehold } from "@/utils/householdHelpers";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { IncomeSourceItem } from "@/components/income/IncomeSourceItem";
import { IncomeSourceDialog } from "@/components/income/IncomeSourceDialog";
import { OneTimeIncomeCard } from "@/components/income/OneTimeIncomeCard";
import { useIncomeSources } from "@/components/income/hooks/useIncomeSources";
import { getCurrentFinancialMonth, getFinancialMonthRange, formatFinancialMonth } from "@/utils/dateUtils";

const Income = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [household, setHousehold] = useState<any>(null);
  const [incomeSources, setIncomeSources] = useState<any[]>([]);
  const [monthlyIncomes, setMonthlyIncomes] = useState<any[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [oneTimeIncomes, setOneTimeIncomes] = useState<any[]>([]);
  const [coParents, setCoParents] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [hasSaved, setHasSaved] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);

  const currentMonth = getCurrentFinancialMonth();
  const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth);

  const fetchData = async () => {
    if (!user) return;

    const { membership } = await getActiveHousehold(user.id);

    if (!membership) return;

    const [
      { data: householdInfo },
      { data: sourcesData },
      { data: monthlyData },
      { data: coParentsData },
      { data: membersData },
    ] = await Promise.all([
      supabase.from("households").select("*").eq("id", membership.household_id).single(),
      supabase.from("income_sources").select("*, profiles(full_name, avatar_url)").eq("household_id", membership.household_id).eq("is_active", true).order("created_at", { ascending: true }),
      supabase.from("monthly_incomes").select("*").eq("household_id", membership.household_id).gte("month_end", format(monthStart, "yyyy-MM-dd")).lte("month_start", format(monthEnd, "yyyy-MM-dd")),
      supabase.from("co_parents").select("*").eq("household_id", membership.household_id),
      supabase.from("household_members").select("*, profiles(full_name, email)").eq("household_id", membership.household_id),
    ]);

    setHousehold(householdInfo);
    setIncomeSources(sourcesData || []);
    setCoParents(coParentsData || []);
    setMembers(membersData || []);

    // Separate regular incomes and one-time incomes
    const regularIncomes = (monthlyData || []).filter((m: any) => m.income_source_id !== null);
    const oneTimeIncomesData = (monthlyData || []).filter((m: any) => m.income_source_id === null);

    setMonthlyIncomes(regularIncomes);
    setOneTimeIncomes(oneTimeIncomesData);

    // Check if there are saved incomes to determine button state
    if (regularIncomes.length > 0) {
      setHasSaved(true);
      // Get the most recent updated_at timestamp
      const mostRecent = regularIncomes.reduce((latest: any, current: any) => {
        const latestDate = new Date(latest.updated_at || latest.created_at || 0);
        const currentDate = new Date(current.updated_at || current.created_at || 0);
        return currentDate > latestDate ? current : latest;
      });

      const dateToUse = mostRecent.updated_at || mostRecent.created_at;
      const savedDate = new Date(dateToUse);

      // Only set if it's a valid date
      if (!isNaN(savedDate.getTime())) {
        setLastSavedTime(savedDate);
      }
    } else {
      // Reset when no saved incomes
      setHasSaved(false);
      setLastSavedTime(null);
    }

    const initialAmounts: Record<string, string> = {};
    (sourcesData || []).forEach((source: any) => {
      const existing = (monthlyData || []).find((m: any) => m.income_source_id === source.id);
      initialAmounts[source.id] = existing ? existing.amount.toString() : source.default_amount.toString();
    });
    setAmounts(initialAmounts);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

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

  const handleSave = async () => {
    if (!household || !user) return;
    setSaving(true);

    const entries = incomeSources.map((source) => ({
      income_source_id: source.id,
      household_id: household.id,
      month: currentMonth,
      month_start: format(monthStart, "yyyy-MM-dd"),
      month_end: format(monthEnd, "yyyy-MM-dd"),
      amount: parseFloat(amounts[source.id] || "0"),
      created_by: user.id,
    }));

    const { error } = await supabase
      .from("monthly_incomes")
      .upsert(entries, { onConflict: "income_source_id,month" });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save income data",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Monthly income saved",
      });
      setHasSaved(true);
      setLastSavedTime(new Date());
      fetchData();
    }
    setSaving(false);
  };

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
      });

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Income Management</h1>
          <p className="text-muted-foreground mt-2">
            {formatFinancialMonth(currentMonth)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Income</p>
          <p className="text-2xl sm:text-3xl font-bold text-success">
            {totalIncome.toFixed(0)} {household?.currency || "SEK"}
          </p>
        </div>
      </div>

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
                Add your income sources with a default amount, and adjust the actual monthly income if needed. When you're done, click "Save Monthly Income"!
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
              <div className="space-y-3">
                {incomeSources.map((source) => (
                  <IncomeSourceItem
                    key={source.id}
                    source={source}
                    amount={amounts[source.id] || source.default_amount.toString()}
                    currency={household?.currency || "SEK"}
                    onAmountChange={(sourceId, value) =>
                      setAmounts({ ...amounts, [sourceId]: value })
                    }
                    onEdit={handleEditSource}
                    onDelete={handleDeleteSource}
                    showCheckmark={hasSaved && amounts[source.id] === monthlyIncomes.find((m: any) => m.income_source_id === source.id)?.amount.toString()}
                  />
                ))}
              </div>

              {lastSavedTime && !isNaN(lastSavedTime.getTime()) && (
                <p className="text-xs text-center text-muted-foreground mb-2">
                  Monthly income saved {format(lastSavedTime, "MMM d, yyyy 'at' HH:mm")}
                </p>
              )}
              <Button
                onClick={handleSave}
                disabled={saving}
                className={`w-full ${hasSaved ? 'bg-green-900/40 hover:bg-green-900/60 text-green-100 border border-green-800/50' : ''}`}
              >
                {saving ? "Saving..." : hasSaved ? "Update Monthly Income" : "Save Monthly Income"}
              </Button>
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
    </div>
  );
};

export default Income;