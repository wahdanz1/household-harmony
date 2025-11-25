import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { HouseholdInfoCard } from "@/components/settings/HouseholdInfoCard";
import { HouseholdMembersCard } from "@/components/settings/HouseholdMembersCard";
import { IncomeSourcesCard } from "@/components/settings/IncomeSourcesCard";
import { ExpenseCategoriesCard } from "@/components/settings/ExpenseCategoriesCard";

const Settings = () => {
  const { user } = useAuth();
  const [household, setHousehold] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [incomeSources, setIncomeSources] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      { data: membersData },
      { data: incomeData },
      { data: expenseData },
    ] = await Promise.all([
      supabase.from("households").select("*").eq("id", householdData.household_id).single(),
      supabase.from("household_members").select("*, profiles(full_name, email)").eq("household_id", householdData.household_id),
      supabase.from("income_sources").select("*, profiles(full_name)").eq("household_id", householdData.household_id).eq("is_active", true),
      supabase.from("expense_categories").select("*").eq("household_id", householdData.household_id).eq("is_active", true).order("sort_order"),
    ]);

    setHousehold(householdInfo);
    setMembers(membersData || []);
    setIncomeSources(incomeData || []);
    setExpenseCategories(expenseData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!household) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">No household found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your household and preferences</p>
      </div>

      <div className="grid gap-6">
        <HouseholdInfoCard household={household} onUpdate={fetchData} />
        <HouseholdMembersCard members={members} householdId={household.id} onUpdate={fetchData} />
        <IncomeSourcesCard incomeSources={incomeSources} householdId={household.id} members={members} onUpdate={fetchData} />
        <ExpenseCategoriesCard expenseCategories={expenseCategories} householdId={household.id} onUpdate={fetchData} />
      </div>
    </div>
  );
};

export default Settings;