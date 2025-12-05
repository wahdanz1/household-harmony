import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveHousehold } from "@/utils/householdHelpers";
import { HouseholdInfoCard } from "@/components/settings/HouseholdInfoCard";
import { HouseholdMembersCard } from "@/components/settings/HouseholdMembersCard";
import { PersonalSettingsCard } from "@/components/settings/PersonalSettingsCard";
import { ExtraFeaturesCard } from "@/components/settings/ExtraFeaturesCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, Users, User } from "lucide-react";

const Settings = () => {
  const { user } = useAuth();
  const [household, setHousehold] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;

    // Use new helper to get active household
    const { membership, household: householdInfo } = await getActiveHousehold(user.id);

    if (!membership || !householdInfo) return;

    setUserRole(membership.role);
    setHousehold(householdInfo);

    // Fetch members and invites for the active household
    const [
      { data: membersData },
      { data: invitesData },
    ] = await Promise.all([
      supabase.from("household_members").select("*, profiles(full_name, email, email_public)").eq("household_id", membership.household_id),
      supabase.from("household_invites").select("*").eq("household_id", membership.household_id).order("created_at", { ascending: false }),
    ]);

    setMembers(membersData || []);
    setInvites(invitesData || []);
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
          <TabsTrigger value="personal" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Personal</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <div className="space-y-6">
            <HouseholdInfoCard household={household} userRole={userRole} members={members} onUpdate={fetchData} />
            <ExtraFeaturesCard
              householdId={household.id}
              enableCreditCards={household.enable_credit_cards || false}
              enableSharedExpenses={household.enable_shared_expenses ?? true}
              onUpdate={fetchData}
            />
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

        <TabsContent value="personal" className="mt-6">
          <PersonalSettingsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;