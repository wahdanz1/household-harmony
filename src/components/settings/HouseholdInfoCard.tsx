import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Home, UserPlus, Shuffle, Edit, LogOut } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { JoinExistingUserDialog } from "./JoinExistingUserDialog";
import { useAuth } from "@/contexts/AuthContext";
import { generateHouseholdName } from "@/utils/householdNames";

interface HouseholdInfoCardProps {
  household: {
    id: string;
    name: string;
    currency: string;
    owner_id: string;
  };
  userRole: string;
  members: any[];
  onUpdate: () => void;
}

export const HouseholdInfoCard = ({ household, userRole, members, onUpdate }: HouseholdInfoCardProps) => {
  const { user } = useAuth();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [editName, setEditName] = useState(household.name);
  const [isSaving, setIsSaving] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const { toast } = useToast();

  const isOwner = userRole === "owner";
  const hasOtherMembers = members.length > 1; // More than just the owner
  const shouldShowJoinButton = !isOwner || !hasOtherMembers; // Show if not owner, or owner with no other members

  const handleSaveName = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from("households")
      .update({ name: editName })
      .eq("id", household.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update household name",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Household name updated",
      });
      setShowEditDialog(false);
      onUpdate();
    }
    setIsSaving(false);
  };

  const generateName = () => {
    const newName = generateHouseholdName();
    setEditName(newName);
  };

  const handleLeaveHousehold = async () => {
    if (!user) return;
    setIsLeaving(true);

    // Find user's original household (where they are the owner)
    const { data: originalHousehold, error: findError } = await supabase
      .from("households")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    let targetHouseholdId: string;

    // If no original household exists (user joined during signup), create a new one
    if (!originalHousehold) {
      const newHouseholdName = generateHouseholdName();
      const { data: newHousehold, error: createError } = await supabase
        .from("households")
        .insert({
          name: newHouseholdName,
          owner_id: user.id,
          currency: household.currency, // Keep same currency
        })
        .select("id")
        .single();

      if (createError || !newHousehold) {
        toast({
          title: "Error",
          description: "Failed to create your new household",
          variant: "destructive",
        });
        setIsLeaving(false);
        return;
      }

      targetHouseholdId = newHousehold.id;
    } else {
      targetHouseholdId = originalHousehold.id;
    }

    // Remove from current household
    const { error: removeError } = await supabase
      .from("household_members")
      .delete()
      .eq("user_id", user.id)
      .eq("household_id", household.id);

    if (removeError) {
      toast({
        title: "Error",
        description: "Failed to leave household",
        variant: "destructive",
      });
      setIsLeaving(false);
      return;
    }

    // Add to target household (original or new) as owner
    const { error: addError } = await supabase
      .from("household_members")
      .insert({
        household_id: targetHouseholdId,
        user_id: user.id,
        role: "owner",
      });

    if (addError) {
      toast({
        title: "Error",
        description: "Failed to join your household",
        variant: "destructive",
      });
      setIsLeaving(false);
      return;
    }

    toast({
      title: "Success",
      description: "You've left the household and returned to your own",
    });

    setShowLeaveDialog(false);
    setIsLeaving(false);

    // Reload page to show original household
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              <CardTitle>Household Information</CardTitle>
            </div>
            <CardDescription className="text-xs font-mono text-muted-foreground">
              ID: {household.id}
            </CardDescription>
          </div>
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => {
              setEditName(household.name);
              setShowEditDialog(true);
            }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Household Name Display */}
        <div>
          <h2 className="text-2xl font-bold">{household.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isOwner ? "You are the owner" : "You are a member"}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {shouldShowJoinButton && (
            <Button variant="outline" onClick={() => setShowJoinDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Join Another Household
            </Button>
          )}

          {!isOwner && (
            <Button variant="outline" onClick={() => setShowLeaveDialog(true)}>
              <LogOut className="h-4 w-4 mr-2" />
              Leave Household
            </Button>
          )}
        </div>
      </CardContent>

      {/* Edit Name Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Household Name</DialogTitle>
            <DialogDescription>
              Change your household's name
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Household Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="My Household"
              />
            </div>
            <Button variant="outline" onClick={generateName} className="w-full">
              <Shuffle className="h-4 w-4 mr-2" />
              Generate Random Name
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveName} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Household Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Household?</DialogTitle>
            <DialogDescription>
              You'll return to your original household. All your data will be preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to leave <span className="font-semibold">{household.name}</span>?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLeaveHousehold} disabled={isLeaving}>
              {isLeaving ? "Leaving..." : "Leave Household"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <JoinExistingUserDialog
        open={showJoinDialog}
        onOpenChange={setShowJoinDialog}
        onSuccess={onUpdate}
      />
    </Card>
  );
};
