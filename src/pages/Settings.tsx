import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { HouseholdInfoCard } from "@/components/settings/HouseholdInfoCard";
import { HouseholdMembersCard } from "@/components/settings/HouseholdMembersCard";
import { IncomeSourcesCard } from "@/components/settings/IncomeSourcesCard";
import { ExpenseCategoriesCard } from "@/components/settings/ExpenseCategoriesCard";
import { PersonalSettingsCard } from "@/components/settings/PersonalSettingsCard";
import { CoParentsCard } from "@/components/settings/CoParentsCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, Users, TrendingUp, TrendingDown, User } from "lucide-react";

const Settings = () => {
  const { user } = useAuth();
  const [household, setHousehold] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
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
      { data: invitesData },
      { data: incomeData },
      { data: expenseData },
    ] = await Promise.all([
      supabase.from("households").select("*").eq("id", householdData.household_id).single(),
      supabase.from("household_members").select("*, profiles(full_name, email)").eq("household_id", householdData.household_id),
      supabase.from("household_invites").select("*").eq("household_id", householdData.household_id).order("created_at", { ascending: false }),
      supabase.from("income_sources").select("*, profiles(full_name)").eq("household_id", householdData.household_id).eq("is_active", true),
      supabase.from("expense_categories").select("*").eq("household_id", householdData.household_id).eq("is_active", true).order("sort_order"),
    ]);

    setHousehold(householdInfo);
    setMembers(membersData || []);
    setInvites(invitesData || []);
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

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
          <TabsTrigger value="income" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Income</span>
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            <span className="hidden sm:inline">Expenses</span>
          </TabsTrigger>
          <TabsTrigger value="personal" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Personal</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <div className="space-y-6">
            <HouseholdInfoCard household={household} onUpdate={fetchData} />
            <CoParentsCard householdId={household.id} onUpdate={fetchData} />
          </div>
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <HouseholdMembersCard 
            members={members} 
            householdId={household.id} 
            invites={invites}
            onUpdate={fetchData} 
          />
        </TabsContent>

        <TabsContent value="income" className="mt-6">
          <IncomeSourcesCard 
            incomeSources={incomeSources} 
            householdId={household.id} 
            members={members}
            currency={household.currency}
            onUpdate={fetchData} 
          />
        </TabsContent>

        <TabsContent value="expenses" className="mt-6">
          <ExpenseCategoriesCard 
            expenseCategories={expenseCategories} 
            householdId={household.id}
            currency={household.currency}
            onUpdate={fetchData} 
          />
        </TabsContent>

        <TabsContent value="personal" className="mt-6">
          <PersonalSettingsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;