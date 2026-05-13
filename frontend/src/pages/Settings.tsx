import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { HouseholdCard } from "@/components/settings/HouseholdCard";
import { MembersCard } from "@/components/settings/MembersCard";
import { InvitesCard } from "@/components/settings/InvitesCard";
import { ExtraFeaturesCard } from "@/components/settings/ExtraFeaturesCard";
import { CreditCardsCard } from "@/components/settings/CreditCardsCard";
import { ApiKeysCard } from "@/components/settings/ApiKeysCard";
import { RecoveryCodeCard } from "@/components/settings/RecoveryCodeCard";
import { ResetDataCard } from "@/components/settings/ResetDataCard";
import { SubjectsCard } from "@/components/settings/SubjectsCard";
import { ProfileCard } from "@/components/settings/ProfileCard";
import { PersonalInfoCard } from "@/components/settings/PersonalInfoCard";
import { LoginCard } from "@/components/settings/LoginCard";
import { SettingsCard, SettingsRow, SettingsBadge } from "@/components/settings/SettingsCard";
// import { DataMigrationCard } from "@/components/settings/DataMigrationCard"; // Legacy - kept for future use
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, User, Home as HomeIcon, Shield } from "lucide-react";
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
  // Household, members, and userRole come from HouseholdContext — no
  // separate fetch needed. Only invites are unique to this page.
  const { household, members, userRole, loading: householdLoading, refresh: refreshHousehold } = useHousehold();
  const [invites, setInvites] = useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);

  const fetchInvites = async () => {
    if (!user || !isUnlocked || !household?.id) {
      setLoadingInvites(false);
      return;
    }
    const { data } = await supabase
      .from("household_invites")
      .select("*")
      .eq("household_id", household.id)
      .order("created_at", { ascending: false });
    setInvites(data || []);
    setLoadingInvites(false);
  };

  useEffect(() => {
    fetchInvites();
  }, [user, isUnlocked, household?.id]);

  // Re-fetch both household state (via context) and invites after edits.
  const fetchData = async () => {
    await Promise.all([refreshHousehold(), fetchInvites()]);
  };

  const loading = householdLoading || loadingInvites;

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
            <SettingsCard eyebrow="Theme">
              <SettingsRow
                title="Appearance"
                description="Switch between light and dark mode. Saved per device."
                control={<ThemeToggle showLabel />}
              />
            </SettingsCard>

            <SettingsCard eyebrow="Language">
              <SettingsRow
                title="English (en-US)"
                description="More languages coming soon"
                badge={<SettingsBadge tone="accent">Active</SettingsBadge>}
              />
            </SettingsCard>

            <SettingsCard eyebrow="Notifications" dim>
              <SettingsRow
                title="Bill reminders & summaries"
                description="Weekly recap, Monthly Review nudges, settlement reminders."
                badge={<SettingsBadge>Coming soon</SettingsBadge>}
              />
            </SettingsCard>
          </div>
        </TabsContent>

        <TabsContent value="account" className="mt-5">
          <div className="space-y-5">
            <ProfileCard />
            <div className="grid gap-5 lg:grid-cols-2">
              <PersonalInfoCard />
              <LoginCard />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="household" className="mt-5">
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <HouseholdCard
                household={household}
                members={members}
                userRole={userRole}
                onUpdate={fetchData}
              />
              <MembersCard
                members={members}
                userRole={userRole}
                onUpdate={fetchData}
              />
            </div>
            <InvitesCard
              householdId={household.id}
              invites={invites}
              isOwner={userRole === "owner"}
              onUpdate={fetchData}
            />
            <div className="grid gap-5 lg:grid-cols-2">
              <ExtraFeaturesCard
                householdId={household.id}
                enableCreditCards={household.enable_credit_cards || false}
                enableSharedExpenses={household.enable_shared_expenses ?? true}
                onUpdate={fetchData}
              />
              <SubjectsCard householdId={household.id} onUpdate={fetchData} />
            </div>
            <CreditCardsCard
              householdId={household.id}
              currency={household.currency || "SEK"}
              enabled={!!household.enable_credit_cards}
            />
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