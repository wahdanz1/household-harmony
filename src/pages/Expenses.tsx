import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, subMonths } from "date-fns";

const Expenses = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [household, setHousehold] = useState<any>(null);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<any[]>([]);
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
      { data: categoriesData },
      { data: monthlyData },
      { data: historicalData },
    ] = await Promise.all([
      supabase.from("households").select("*").eq("id", householdData.household_id).single(),
      supabase.from("expense_categories").select("*").eq("household_id", householdData.household_id).eq("is_active", true).order("sort_order"),
      supabase.from("monthly_expenses").select("*").eq("household_id", householdData.household_id).eq("month", currentMonth),
      supabase.from("monthly_expenses").select("*").eq("household_id", householdData.household_id).lt("month", currentMonth),
    ]);

    setHousehold(householdInfo);
    setExpenseCategories(categoriesData || []);
    setMonthlyExpenses(monthlyData || []);

    const initialAmounts: Record<string, string> = {};
    (categoriesData || []).forEach((category: any) => {
      const existing = (monthlyData || []).find((m: any) => m.expense_category_id === category.id);
      
      if (existing) {
        initialAmounts[category.id] = existing.amount.toString();
      } else if (category.type === "dynamic") {
        const history = (historicalData || []).filter((h: any) => h.expense_category_id === category.id);
        if (history.length > 0) {
          const avg = history.reduce((sum: number, h: any) => sum + parseFloat(h.amount), 0) / history.length;
          initialAmounts[category.id] = avg.toFixed(0);
        } else {
          initialAmounts[category.id] = category.default_amount.toString();
        }
      } else {
        initialAmounts[category.id] = category.default_amount.toString();
      }
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

    const entries = expenseCategories.map((category) => ({
      expense_category_id: category.id,
      household_id: household.id,
      month: currentMonth,
      amount: parseFloat(amounts[category.id] || "0"),
      created_by: user.id,
    }));

    const { error } = await supabase
      .from("monthly_expenses")
      .upsert(entries, { onConflict: "expense_category_id,month" });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save expense data",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Monthly expenses saved",
      });
      fetchData();
    }
    setSaving(false);
  };

  const totalExpenses = Object.values(amounts).reduce((sum, val) => sum + parseFloat(val || "0"), 0);
  const staticCategories = expenseCategories.filter(c => c.type === "static");
  const dynamicCategories = expenseCategories.filter(c => c.type === "dynamic");

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
          <h1 className="text-3xl font-bold tracking-tight">Expense Management</h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(currentMonth), "MMMM yyyy")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Expenses</p>
          <p className="text-3xl font-bold text-destructive">
            {totalExpenses.toFixed(0)} {household?.currency || "SEK"}
          </p>
        </div>
      </div>

      {expenseCategories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
            <p>No expense categories configured</p>
            <p className="text-sm">Go to Settings to add expense categories</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {staticCategories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                  Static Expenses
                </CardTitle>
                <CardDescription>Fixed monthly expenses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {staticCategories.map((category) => {
                  const hasEntry = monthlyExpenses.some((m) => m.expense_category_id === category.id);
                  const isDifferent = amounts[category.id] !== category.default_amount.toString();

                  return (
                    <div
                      key={category.id}
                      className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background/40"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{category.name}</p>
                          <Badge variant="secondary">Static</Badge>
                          {hasEntry && <Check className="h-4 w-4 text-success" />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Default: {category.default_amount}
                        </p>
                      </div>
                      <Input
                        type="number"
                        value={amounts[category.id] || ""}
                        onChange={(e) => setAmounts({ ...amounts, [category.id]: e.target.value })}
                        className={`w-32 ${isDifferent ? "border-primary" : ""}`}
                        placeholder="0"
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {dynamicCategories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                  Dynamic Expenses
                </CardTitle>
                <CardDescription>Variable expenses with rolling averages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dynamicCategories.map((category) => {
                  const hasEntry = monthlyExpenses.some((m) => m.expense_category_id === category.id);

                  return (
                    <div
                      key={category.id}
                      className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background/40"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{category.name}</p>
                          <Badge variant="outline">Dynamic</Badge>
                          {hasEntry && <Check className="h-4 w-4 text-success" />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Suggested: {amounts[category.id]} (rolling avg)
                        </p>
                      </div>
                      <Input
                        type="number"
                        value={amounts[category.id] || ""}
                        onChange={(e) => setAmounts({ ...amounts, [category.id]: e.target.value })}
                        className="w-32"
                        placeholder="0"
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Monthly Expenses"}
          </Button>
        </>
      )}
    </div>
  );
};

export default Expenses;