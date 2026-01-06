import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveHousehold } from "@/utils/householdHelpers";
import { HouseholdInfoCard } from "@/components/settings/HouseholdInfoCard";
import { HouseholdMembersCard } from "@/components/settings/HouseholdMembersCard";
import { PersonalSettingsCard } from "@/components/settings/PersonalSettingsCard";
import { ExtraFeaturesCard } from "@/components/settings/ExtraFeaturesCard";
import { ApiKeysCard } from "@/components/settings/ApiKeysCard";
import { DataMigrationCard } from "@/components/settings/DataMigrationCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Home, User, Shield, AlertTriangle } from "lucide-react";
import { useEncryption } from "@/contexts/EncryptionContext";
import { VaultUnlockButton } from "@/components/shared/VaultUnlockDialog";
import { PageHeader } from "@/components/shared/PageHeader";

const Settings = () => {
  const { user } = useAuth();
  const { isUnlocked } = useEncryption();
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
      <div className="space-y-4">
        <PageHeader
          title="Settings"
          subtitle="Manage your household and preferences"
        />
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
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
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        subtitle="Manage your household and preferences"
      />

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="personal" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Personal</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <div className="space-y-6">
            {/* Household Info & Members - 2 column grid on desktop */}
            <div className="grid gap-6 lg:grid-cols-2">
              <HouseholdInfoCard household={household} userRole={userRole} members={members} onUpdate={fetchData} />
              <HouseholdMembersCard
                members={members}
                householdId={household.id}
                invites={invites}
                onUpdate={fetchData}
              />
            </div>
            <ExtraFeaturesCard
              householdId={household.id}
              enableCreditCards={household.enable_credit_cards || false}
              enableSharedExpenses={household.enable_shared_expenses ?? true}
              onUpdate={fetchData}
            />
          </div>
        </TabsContent>

        <TabsContent value="personal" className="mt-6">
          <PersonalSettingsCard />
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <div className="space-y-6">
            {!isUnlocked && (
              <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-500 mb-6 flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-full bg-amber-500/10 shrink-0">
                    <AlertTriangle className="h-6 w-6 stroke-amber-500" />
                  </div>
                  <div>
                    <AlertTitle className="text-lg font-semibold mb-1">Vault Locked</AlertTitle>
                    <AlertDescription className="text-base text-amber-500/90">
                      Your vault is locked. Please unlock it to view and manage sensitive data.
                    </AlertDescription>
                  </div>
                </div>

                <VaultUnlockButton
                  variant="outline"
                  className="h-10 px-6 ml-4 border-amber-500/50 hover:bg-amber-500/20 hover:text-amber-500 text-base font-medium whitespace-nowrap"
                />
              </Alert>
            )}

            <div className={!isUnlocked ? "opacity-50 pointer-events-none select-none grayscale-[0.5] transition-all duration-300" : "transition-all duration-300"}>
              <div className="space-y-6">
                <ApiKeysCard />
                <DataMigrationCard />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;