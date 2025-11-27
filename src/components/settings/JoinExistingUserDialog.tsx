import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Check, Users, ArrowRight, ArrowLeft } from "lucide-react";

interface JoinExistingUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export const JoinExistingUserDialog = ({ open, onOpenChange, onSuccess }: JoinExistingUserDialogProps) => {
    const { user } = useAuth();
    const { toast } = useToast();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Step 1: Invite code
    const [inviteCode, setInviteCode] = useState("");

    // Step 2: Household preview
    const [household, setHousehold] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);

    const resetDialog = () => {
        setStep(1);
        setInviteCode("");
        setHousehold(null);
        setMembers([]);
    };

    const handleValidateCode = async () => {
        if (!inviteCode || inviteCode.length !== 6) {
            toast({
                title: "Invalid Code",
                description: "Please enter a valid 6-digit invite code",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);

        // Fetch invite and household info
        const { data: invite, error: inviteError } = await supabase
            .from("household_invites")
            .select("*, households(*)")
            .eq("invite_code", inviteCode.toUpperCase())
            .eq("is_active", true)
            .maybeSingle();

        if (inviteError || !invite) {
            toast({
                title: "Invalid Code",
                description: "This invite code is invalid or has expired",
                variant: "destructive",
            });
            setLoading(false);
            return;
        }

        // Check if user is already in this household
        const { data: existingMember } = await supabase
            .from("household_members")
            .select("*")
            .eq("household_id", invite.household_id)
            .eq("user_id", user?.id)
            .maybeSingle();

        if (existingMember) {
            toast({
                title: "Already a Member",
                description: "You're already a member of this household",
                variant: "destructive",
            });
            setLoading(false);
            return;
        }

        // Fetch household members
        const { data: membersData } = await supabase
            .from("household_members")
            .select("*, profiles(full_name, avatar_url)")
            .eq("household_id", invite.household_id);

        setHousehold(invite.households);
        setMembers(membersData || []);
        setStep(2);
        setLoading(false);
    };

    const handleJoinHousehold = async () => {
        if (!user || !household) return;

        setLoading(true);

        // Get user's current household membership
        const { data: currentMembership } = await supabase
            .from("household_members")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();


        // Remove from old household if exists
        if (currentMembership) {
            await supabase
                .from("household_members")
                .delete()
                .eq("user_id", user.id)
                .eq("household_id", currentMembership.household_id);
        }

        // Add to new household
        const { error: joinError } = await supabase
            .from("household_members")
            .insert({
                household_id: household.id,
                user_id: user.id,
                role: "member",
            });

        if (joinError) {
            toast({
                title: "Error",
                description: "Failed to join household",
                variant: "destructive",
            });
            setLoading(false);
            return;
        }

        // Update invite status to accepted and deactivate
        await supabase
            .from("household_invites")
            .update({
                status: "accepted",
                is_active: false
            })
            .eq("household_id", household.id)
            .eq("is_active", true);

        toast({
            title: "Success!",
            description: `You've joined ${household.name}`,
        });

        resetDialog();
        onOpenChange(false);
        setLoading(false);

        // Refresh the page to load new household data
        if (onSuccess) {
            onSuccess();
        } else {
            window.location.reload();
        }
    };

    return (
        <Dialog open={open} onOpenChange={(open) => {
            onOpenChange(open);
            if (!open) resetDialog();
        }}>
            <DialogContent className="sm:max-w-[500px]">
                {step === 1 && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Join Another Household</DialogTitle>
                            <DialogDescription>
                                Enter the 6-digit invite code to join a household
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="invite-code">Invite Code</Label>
                                <Input
                                    id="invite-code"
                                    placeholder="ABC123"
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    className="text-center text-2xl font-mono tracking-widest"
                                />
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Note: You'll leave your current household when you join a new one.
                            </p>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleValidateCode} disabled={loading || inviteCode.length !== 6}>
                                {loading ? "Validating..." : "Continue"}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {step === 2 && household && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                {household.name}
                            </DialogTitle>
                            <DialogDescription>
                                Review the household before joining
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <h4 className="text-sm font-semibold mb-3">Current Members ({members.length})</h4>
                                <div className="space-y-2">
                                    {members.map((member) => (
                                        <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg border">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={member.profiles?.avatar_url} />
                                                <AvatarFallback>
                                                    {member.profiles?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "?"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <p className="font-medium">{member.profiles?.full_name || "Unknown"}</p>
                                                <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                                            </div>
                                            {member.role === "owner" && (
                                                <Check className="h-4 w-4 text-success" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setStep(1)}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                            <Button onClick={handleJoinHousehold} disabled={loading}>
                                {loading ? "Joining..." : "Join Household"}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
