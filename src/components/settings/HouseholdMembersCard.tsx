import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, UserMinus, Crown, Copy, Check, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { format } from "date-fns";
import { PLACEHOLDERS } from "@/constants/ui";

interface Member {
  id: string;
  user_id: string;
  role: string;
  profiles: {
    full_name: string;
    email: string;
    email_public: boolean;
  };
}

interface Invite {
  id: string;
  invite_code: string;
  invited_email: string | null;
  status: string;
  expires_at: string;
  created_at: string;
}

interface HouseholdMembersCardProps {
  members: Member[];
  householdId: string;
  invites: Invite[];
  onUpdate: () => void;
}

export const HouseholdMembersCard = ({ members, householdId, invites, onUpdate }: HouseholdMembersCardProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const currentMember = members.find(m => m.user_id === user?.id);
  const isOwner = currentMember?.role === "owner";
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const generateInviteCode = () => {
    return Math.random().toString().slice(2, 8).padStart(6, '0');
  };

  const handleGenerateInvite = async () => {
    if (!user) return;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!inviteEmail || !emailRegex.test(inviteEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    const inviteCode = generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { error } = await supabase
      .from("household_invites")
      .insert({
        household_id: householdId,
        invite_code: inviteCode,
        invited_email: inviteEmail,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
        status: "pending",
      });

    setIsGenerating(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to generate invite code",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: `Invite created for ${inviteEmail}`,
    });
    setShowEmailDialog(false);
    setInviteEmail("");
    onUpdate();
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({
      title: "Copied!",
      description: "Invite code copied to clipboard",
    });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleRemoveMember = async (memberId: string) => {
    // Get the member's user_id before deleting
    const memberToRemove = members.find(m => m.id === memberId);
    if (!memberToRemove) return;

    const { error: deleteError } = await supabase
      .from("household_members")
      .delete()
      .eq("id", memberId);

    if (deleteError) {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
      return;
    }

    // Find their original household (where they are the owner)
    const { data: originalHousehold } = await supabase
      .from("households")
      .select("id")
      .eq("owner_id", memberToRemove.user_id)
      .maybeSingle();

    let targetHouseholdId: string;

    // If no original household, create a new one
    if (!originalHousehold) {
      const { data: newHousehold } = await supabase
        .from("households")
        .insert({
          name: `${memberToRemove.profiles.full_name}'s Household`,
          owner_id: memberToRemove.user_id,
          currency: "SEK",
        })
        .select("id")
        .single();

      targetHouseholdId = newHousehold?.id || "";
    } else {
      targetHouseholdId = originalHousehold.id;
    }

    // Add them back to their household as owner (upsert to avoid conflicts)
    if (targetHouseholdId) {
      await supabase
        .from("household_members")
        .upsert({
          household_id: targetHouseholdId,
          user_id: memberToRemove.user_id,
          role: "owner",
        }, {
          onConflict: "household_id,user_id"
        });
    }

    toast({
      title: "Success",
      description: "Member removed and returned to their household",
    });
    onUpdate();
  };

  const handleDeleteInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from("household_invites")
      .delete()
      .eq("id", inviteId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete invite",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Invite code deleted",
      });
      onUpdate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Household Members
        </CardTitle>
        <CardDescription className="mt-1.5">Manage who has access to this household</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{member.profiles.full_name || "Unknown"}</p>
                  {member.role === "owner" && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      Owner
                    </Badge>
                  )}
                  {member.user_id === user?.id && (
                    <Badge variant="outline">You</Badge>
                  )}
                </div>
                {member.profiles.email_public && (
                  <p className="text-sm text-muted-foreground">{member.profiles.email}</p>
                )}
              </div>

              {isOwner && member.role !== "owner" && member.user_id !== user?.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveMember(member.id)}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {isOwner && (
          <>
            <div className="pt-6 border-t">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Invite Members</h3>
                  <p className="text-sm text-muted-foreground">Generate a 6-digit code that expires in 24 hours</p>
                </div>
                <Button onClick={() => setShowEmailDialog(true)}>
                  Invite Member
                </Button>
              </div>
            </div>

            {invites.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Active Invites</h4>
                {invites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <code className="font-mono text-lg font-bold">{invite.invite_code}</code>
                        <Badge variant={invite.status === "pending" ? "default" : "secondary"}>
                          {invite.status}
                        </Badge>
                      </div>
                      {invite.invited_email && (
                        <div className="text-sm text-muted-foreground mt-1">
                          For: <Badge variant="secondary">{invite.invited_email}</Badge>
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        Expires: {format(new Date(invite.expires_at), "PPP")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyInviteCode(invite.invite_code)}
                      >
                        {copiedCode === invite.invite_code ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteInvite(invite.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Email Input Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a Member</DialogTitle>
            <DialogDescription>
              Enter the email address of the person you want to invite to your household.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="member-invite-email">Email Address</Label>
              <Input
                id="member-invite-email"
                type="email"
                placeholder={PLACEHOLDERS.EMAIL}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isGenerating) {
                    handleGenerateInvite();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)} disabled={isGenerating}>
              Cancel
            </Button>
            <Button onClick={handleGenerateInvite} disabled={isGenerating}>
              {isGenerating ? "Creating..." : "Generate Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
