import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth } from "date-fns";

const Income = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [household, setHousehold] = useState<any>(null);
  const [incomeSources, setIncomeSources] = useState<any[]>([]);
  const [monthlyIncomes, setMonthlyIncomes] = useState<any[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const fetchData = async () => {
    if (!user) return;

    const { data: householdData } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .single();

    if (!householdData) return;

    const [
      { data: householdInfo },
      { data: sourcesData },
      { data: monthlyData },
    ] = await Promise.all([
      supabase.from("households").select("*").eq("id", householdData.household_id).single(),
      supabase.from("income_sources").select("*, profiles(full_name)").eq("household_id", householdData.household_id).eq("is_active", true),
      supabase.from("monthly_incomes").select("*").eq("household_id", householdData.household_id).eq("month", currentMonth),
    ]);

    setHousehold(householdInfo);
    setIncomeSources(sourcesData || []);
    setMonthlyIncomes(monthlyData || []);

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

  const handleSave = async () => {
    if (!household || !user) return;
    setSaving(true);

    const entries = incomeSources.map((source) => ({
      income_source_id: source.id,
      household_id: household.id,
      month: currentMonth,
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
      fetchData();
    }
    setSaving(false);
  };

  const totalIncome = Object.values(amounts).reduce((sum, val) => sum + parseFloat(val || "0"), 0);

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
          <p className="text-muted-foreground mt-1">
            {format(new Date(currentMonth), "MMMM yyyy")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Income</p>
          <p className="text-3xl font-bold text-success">
            {totalIncome.toFixed(0)} {household?.currency || "SEK"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-success" />
            Monthly Income Entry
          </CardTitle>
          <CardDescription>
            Update amounts that differ from defaults
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {incomeSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
              <p>No income sources configured</p>
              <p className="text-sm">Go to Settings to add income sources</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {incomeSources.map((source) => {
                  const hasEntry = monthlyIncomes.some((m) => m.income_source_id === source.id);
                  const isDifferent = amounts[source.id] !== source.default_amount.toString();

                  return (
                    <div
                      key={source.id}
                      className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background/40"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{source.name}</p>
                          <Badge variant={source.type === "static" ? "secondary" : "outline"}>
                            {source.type}
                          </Badge>
                          {hasEntry && <Check className="h-4 w-4 text-success" />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {source.profiles.full_name} • Default: {source.default_amount}
                        </p>
                      </div>
                      <Input
                        type="number"
                        value={amounts[source.id] || ""}
                        onChange={(e) => setAmounts({ ...amounts, [source.id]: e.target.value })}
                        className={`w-32 ${isDifferent ? "border-primary" : ""}`}
                        placeholder="0"
                      />
                    </div>
                  );
                })}
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Save Monthly Income"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Income;