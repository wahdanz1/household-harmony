import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Copy, Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";

interface Invite {
  id: string;
  invite_code: string;
  invited_email: string | null;
  expires_at: string;
  status: string;
  created_at: string;
}

interface HouseholdInvitesCardProps {
  invites: Invite[];
  householdId: string;
  onUpdate: () => void;
}

const generateInviteCode = (): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

export const HouseholdInvitesCard = ({ invites, householdId, onUpdate }: HouseholdInvitesCardProps) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const handleCreateInvite = async () => {
    setCreating(true);
    
    const inviteCode = generateInviteCode();
    const expiresAt = format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm:ss");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create invites",
        variant: "destructive",
      });
      setCreating(false);
      return;
    }

    const { error } = await supabase
      .from("household_invites")
      .insert({
        household_id: householdId,
        invite_code: inviteCode,
        expires_at: expiresAt,
        status: "pending",
        created_by: user.id,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create invite",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Invite code created! Share it with others to join.",
      });
      onUpdate();
    }
    setCreating(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    toast({
      title: "Copied!",
      description: "Invite code copied to clipboard",
    });
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDeleteInvite = async (id: string) => {
    const { error } = await supabase
      .from("household_invites")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete invite",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Invite deleted",
      });
      onUpdate();
    }
  };

  const activeInvites = invites.filter(
    (invite) => invite.status === "pending" && new Date(invite.expires_at) > new Date()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          Invite Members
        </CardTitle>
        <CardDescription>
          Generate invite codes that others can use to join your household
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleCreateInvite} disabled={creating} className="w-full">
          <UserPlus className="h-4 w-4 mr-2" />
          {creating ? "Creating..." : "Generate Invite Code"}
        </Button>

        {activeInvites.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Active Invites</p>
            {activeInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-background/40"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <code className="text-2xl font-bold tracking-wider">
                      {invite.invite_code}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyCode(invite.invite_code)}
                    >
                      {copied === invite.invite_code ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Expires: {format(new Date(invite.expires_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteInvite(invite.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">
            No active invites. Create one to invite members!
          </p>
        )}
      </CardContent>
    </Card>
  );
};
