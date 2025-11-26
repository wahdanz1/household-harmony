import { useEffect, useState } from "react";
import { format, startOfMonth } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, CreditCard, Shield, ShoppingBag } from "lucide-react";
import { MonthlyExpenses } from "@/components/expenses/MonthlyExpenses";
import { SubscriptionsTab } from "@/components/expenses/SubscriptionsTab";
import { InsuranceTab } from "@/components/expenses/InsuranceTab";
import { SharedExpensesTab } from "@/components/expenses/SharedExpensesTab";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Expenses = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [household, setHousehold] = useState<any>(null);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [insurances, setInsurances] = useState<any[]>([]);
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
      { data: subscriptionsData },
      { data: insurancesData },
    ] = await Promise.all([
      supabase.from("households").select("*").eq("id", householdData.household_id).single(),
      supabase.from("expense_categories").select("*").eq("household_id", householdData.household_id).eq("is_active", true).order("sort_order"),
      supabase.from("monthly_expenses").select("*").eq("household_id", householdData.household_id).eq("month", currentMonth),
      supabase.from("monthly_expenses").select("*").eq("household_id", householdData.household_id).lt("month", currentMonth),
      supabase.from("subscriptions").select("*").eq("household_id", householdData.household_id).eq("is_active", true),
      supabase.from("insurances").select("*").eq("household_id", householdData.household_id).eq("is_active", true),
    ]);

    setHousehold(householdInfo);
    setExpenseCategories(categoriesData || []);
    setMonthlyExpenses(monthlyData || []);
    setSubscriptions(subscriptionsData || []);
    setInsurances(insurancesData || []);

    const initialAmounts: Record<string, string> = {};
    (categoriesData || []).forEach((category: any) => {
      const existing = (monthlyData || []).find((m: any) => m.expense_category_id === category.id);
      if (existing) {
        initialAmounts[category.id] = existing.amount.toString();
      } else if (category.type === "dynamic") {
        const previousExpenses = (historicalData || []).filter((h: any) => h.expense_category_id === category.id);
        if (previousExpenses.length > 0) {
          const total = previousExpenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);
          const avg = total / previousExpenses.length;
          initialAmounts[category.id] = Math.round(avg).toString();
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
        description: "Failed to save expenses",
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

  const subscriptionsTotal = subscriptions.reduce((sum, sub) => sum + parseFloat(sub.amount), 0);
  const insuranceTotal = insurances.reduce((sum, ins) => {
    const frequency = ins.payment_frequency === "yearly" ? 12 : ins.payment_frequency === "semi-annual" ? 6 : 3;
    return sum + parseFloat(ins.total_amount) / frequency;
  }, 0);
  const totalExpenses = Object.values(amounts).reduce((sum, val) => sum + parseFloat(val || "0"), 0) + subscriptionsTotal + insuranceTotal;

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

      <Tabs defaultValue="monthly" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="monthly" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Monthly</span>
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Subscriptions</span>
          </TabsTrigger>
          <TabsTrigger value="insurance" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Insurance</span>
          </TabsTrigger>
          <TabsTrigger value="shared" className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Shared</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="mt-6">
          <MonthlyExpenses
            expenseCategories={expenseCategories}
            monthlyExpenses={monthlyExpenses}
            amounts={amounts}
            currency={household?.currency || "SEK"}
            saving={saving}
            subscriptionsTotal={subscriptionsTotal}
            insuranceTotal={insuranceTotal}
            onAmountsChange={setAmounts}
            onSave={handleSave}
          />
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-6">
          <SubscriptionsTab
            householdId={household?.id}
            currency={household?.currency || "SEK"}
          />
        </TabsContent>

        <TabsContent value="insurance" className="mt-6">
          <InsuranceTab
            householdId={household?.id}
            currency={household?.currency || "SEK"}
          />
        </TabsContent>

        <TabsContent value="shared" className="mt-6">
          <SharedExpensesTab
            householdId={household?.id}
            currency={household?.currency || "SEK"}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Expenses;
