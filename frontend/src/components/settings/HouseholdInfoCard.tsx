import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Home, UserPlus, Shuffle, Edit, LogOut } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { JoinExistingUserDialog } from "./JoinExistingUserDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { generateHouseholdName } from "@/utils/householdNames";
import { isDemoMode } from "@/utils/demoMode";

interface HouseholdInfoCardProps {
  household: {
    id: string;
    name: string;
    currency: string;
    owner_id: string;
    financial_month_start?: number;
  };
  userRole: string;
  members: any[];
  onUpdate: () => void;
}

export const HouseholdInfoCard = ({ household, userRole, members, onUpdate }: HouseholdInfoCardProps) => {
  const { user } = useAuth();
  const { refresh: refreshHousehold } = useHousehold();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [editName, setEditName] = useState(household.name);
  const [editFinancialMonthStart, setEditFinancialMonthStart] = useState(household.financial_month_start || 25);
  const [isSaving, setIsSaving] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const { toast } = useToast();

  const isOwner = userRole === "owner";
  const hasOtherMembers = members.length > 1; // More than just the owner
  const shouldShowJoinButton = !isOwner || !hasOtherMembers; // Show if not owner, or owner with no other members
  const demoMode = isDemoMode();

  const handleSaveName = async () => {
    // Validate financial_month_start
    if (editFinancialMonthStart < 1 || editFinancialMonthStart > 28) {
      toast({
        title: "Invalid Day",
        description: "Financial month start must be between 1 and 28",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from("households")
      .update({
        name: editName,
        financial_month_start: editFinancialMonthStart
      })
      .eq("id", household.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update household settings",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Household settings updated",
      });
      setShowEditDialog(false);
      await refreshHousehold(); // Refresh the global context with new settings
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

    // Simply delete the member role (owner role remains, user returns to it automatically)
    const { error: deleteError } = await supabase
      .from("household_members")
      .delete()
      .eq("user_id", user.id)
      .eq("household_id", household.id)
      .eq("role", "member"); // Only delete member role, keep owner role

    if (deleteError) {
      toast({
        title: "Error",
        description: "Failed to leave household",
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
          <div className="space-y-1.5 flex-1">
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
              setEditFinancialMonthStart(household.financial_month_start || 25);
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
          <h2>{household.name}</h2>
          <p className="text-muted-foreground">
            {isOwner ? "You are the owner" : "You are a member"}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {shouldShowJoinButton && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      onClick={() => setShowJoinDialog(true)}
                      disabled={demoMode}
                      className={demoMode ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Join Another Household
                    </Button>
                  </span>
                </TooltipTrigger>
                {isDemoMode && (
                  <TooltipContent>
                    <p>This feature is disabled in the demo</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
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

            <div className="space-y-2">
              <Label htmlFor="edit-month-start">Financial Month Start Day</Label>
              <Input
                id="edit-month-start"
                type="number"
                min={1}
                max={28}
                value={editFinancialMonthStart}
                onChange={(e) => setEditFinancialMonthStart(parseInt(e.target.value) || 25)}
                placeholder="25"
              />
              <p className="text-xs text-muted-foreground">
                Day of month when your financial month starts (1-28, default: 25).<br />
                Example: 25 = Nov 25 - Dec 24. This controls when income/expenses auto-fill.
              </p>
            </div>
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
