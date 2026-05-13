import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveHousehold } from "@/utils/householdHelpers";
import { HouseholdInfoCard } from "@/components/settings/HouseholdInfoCard";
import { HouseholdMembersCard } from "@/components/settings/HouseholdMembersCard";
import { PersonalSettingsCard } from "@/components/settings/PersonalSettingsCard";
import { ExtraFeaturesCard } from "@/components/settings/ExtraFeaturesCard";
import { ApiKeysCard } from "@/components/settings/ApiKeysCard";
import { RecoveryCodeCard } from "@/components/settings/RecoveryCodeCard";
import { ResetDataCard } from "@/components/settings/ResetDataCard";
import { SetupWizardCard } from "@/components/settings/SetupWizardCard";
import { SubjectsCard } from "@/components/settings/SubjectsCard";
import { ComingSoonCard } from "@/components/settings/ComingSoonCard";
import { LanguageCard } from "@/components/settings/LanguageCard";
// import { DataMigrationCard } from "@/components/settings/DataMigrationCard"; // Legacy - kept for future use
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings as SettingsIcon, User, Home as HomeIcon, Shield, Bell, KeyRound } from "lucide-react";
import { useEncryption } from "@/contexts/EncryptionContext";
import { VaultLockedAlert } from "@/components/shared/VaultLockedAlert";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { LoadingState } from "@/components/shared/states";
import { SettingsPageSkeleton } from "@/components/shared/skeletons/PageSkeletons";
import { AvatarTrigger } from "@/components/shared/AvatarTrigger";
import { UserMenu } from "@/components/shared/UserMenu";

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
    if (!isUnlocked) {
      setLoading(false);
      return;
    }

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
  }, [user, isUnlocked]);

  if (loading) {
    return (
      <div className="space-y-5">
        <SettingsHeader />
        <SettingsPageSkeleton />
      </div>
    );
  }

  // Gate the entire page behind vault unlock — household members, invites,
  // profile data, and API keys are all sensitive and shouldn't be visible
  // to anyone who hasn't authenticated for the session.
  if (!isUnlocked) {
    return (
      <div className="space-y-5">
        <SettingsHeader />
        <VaultLockedAlert />
      </div>
    );
  }

  if (!household) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted">No household found</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SettingsHeader />

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
          <TabsTrigger value="household" className="flex items-center gap-2">
            <HomeIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Household</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <CardTitle>Appearance</CardTitle>
                    <CardDescription>Switch between light and dark mode.</CardDescription>
                  </div>
                  <ThemeToggle showLabel />
                </div>
              </CardHeader>
            </Card>
            <LanguageCard />
            <ComingSoonCard
              title="Notifications"
              description="Bill reminders, weekly summaries, settlement nudges."
              icon={<Bell className="h-5 w-5" />}
            />
          </div>
        </TabsContent>

        <TabsContent value="account" className="mt-5">
          <div className="space-y-5">
            <PersonalSettingsCard />
            <ComingSoonCard
              title="Two-factor authentication"
              description="Extra protection at sign-in via authenticator app."
              icon={<KeyRound className="h-5 w-5" />}
            />
          </div>
        </TabsContent>

        <TabsContent value="household" className="mt-5">
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
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
            <SubjectsCard householdId={household.id} onUpdate={fetchData} />
            <SetupWizardCard />
            <ResetDataCard
              householdId={household.id}
              householdName={household.name}
              isOwner={userRole === "owner"}
              onComplete={fetchData}
            />
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-5">
          <div className="space-y-5">
            <RecoveryCodeCard />
            <ApiKeysCard />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const SettingsHeader = () => (
  <div className="flex items-center justify-between gap-4 min-h-9">
    <h1>Settings</h1>
    <div className="md:hidden">
      <UserMenu trigger={<AvatarTrigger />} />
    </div>
  </div>
);

export default Settings;