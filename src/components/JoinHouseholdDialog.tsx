import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface JoinHouseholdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const JoinHouseholdDialog = ({ open, onOpenChange }: JoinHouseholdDialogProps) => {
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter an invite code",
        variant: "destructive",
      });
      return;
    }

    setJoining(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to join a household",
        variant: "destructive",
      });
      setJoining(false);
      return;
    }

    // Check if user is already in a household
    const { data: existingMember } = await supabase
      .from("household_members")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (existingMember) {
      toast({
        title: "Error",
        description: "You are already a member of a household. Leave your current household first.",
        variant: "destructive",
      });
      setJoining(false);
      return;
    }

    // Find the invite
    const { data: invite, error: inviteError } = await supabase
      .from("household_invites")
      .select("*")
      .eq("invite_code", inviteCode.toUpperCase())
      .eq("status", "pending")
      .single();

    if (inviteError || !invite) {
      toast({
        title: "Error",
        description: "Invalid or expired invite code",
        variant: "destructive",
      });
      setJoining(false);
      return;
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      toast({
        title: "Error",
        description: "This invite code has expired",
        variant: "destructive",
      });
      setJoining(false);
      return;
    }

    // Add user to household
    const { error: memberError } = await supabase
      .from("household_members")
      .insert({
        household_id: invite.household_id,
        user_id: user.id,
        role: "member",
      });

    if (memberError) {
      toast({
        title: "Error",
        description: "Failed to join household",
        variant: "destructive",
      });
      setJoining(false);
      return;
    }

    // Mark invite as accepted
    await supabase
      .from("household_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);

    toast({
      title: "Success!",
      description: "You've joined the household!",
    });

    setInviteCode("");
    onOpenChange(false);
    setJoining(false);
    
    // Redirect to dashboard
    navigate("/dashboard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a Household</DialogTitle>
          <DialogDescription>
            Enter the 6-digit invite code you received to join a household
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-code">Invite Code</Label>
            <Input
              id="invite-code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="text-2xl tracking-widest text-center font-bold"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleJoin} disabled={joining || !inviteCode.trim()}>
            {joining ? "Joining..." : "Join Household"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
