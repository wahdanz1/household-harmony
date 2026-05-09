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
        if (!inviteCode || inviteCode.length !== 8) {
            toast({
                title: "Invalid Code",
                description: "Please enter a valid 8-character invite code",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);

        // Use the lookup RPC — household_invites is no longer publicly
        // queryable. The RPC returns the household preview (name, currency,
        // member display info) without exposing the table itself.
        const { data, error } = await supabase.rpc("lookup_active_invite", {
            invite_code_in: inviteCode.toUpperCase(),
        });

        if (error || !data) {
            toast({
                title: "Invalid Code",
                description: "This invite code is invalid or has expired",
                variant: "destructive",
            });
            setLoading(false);
            return;
        }

        const preview = data as {
            household_id: string;
            household_name: string;
            household_currency: string;
            invited_email: string | null;
            members: Array<{
                role: string;
                full_name: string | null;
                avatar_url: string | null;
            }>;
        };

        // "Already a member" is also re-checked server-side by redeem_invite.
        const { data: existingMember } = await supabase
            .from("household_members")
            .select("id")
            .eq("household_id", preview.household_id)
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

        setHousehold({
            id: preview.household_id,
            name: preview.household_name,
            currency: preview.household_currency,
        });
        setMembers(
            preview.members.map((m, idx) => ({
                id: String(idx),
                role: m.role,
                profiles: { full_name: m.full_name, avatar_url: m.avatar_url },
            }))
        );
        setStep(2);
        setLoading(false);
    };

    const handleJoinHousehold = async () => {
        if (!user || !household) return;

        setLoading(true);

        // Single atomic RPC: validates the invite, inserts the membership,
        // and consumes the invite in one transaction.
        const { error } = await supabase.rpc("redeem_invite", {
            invite_code_in: inviteCode.toUpperCase(),
        });

        if (error) {
            const message =
                error.message === "email_mismatch"
                    ? "This invite is for a different email address."
                    : error.message === "invite_not_found"
                    ? "This invite is no longer valid."
                    : error.message === "already_member"
                    ? "You are already a member of this household."
                    : "Failed to join household";

            toast({
                title: "Error",
                description: message,
                variant: "destructive",
            });
            setLoading(false);
            return;
        }

        toast({
            title: "Success!",
            description: `You've joined ${household.name}`,
        });

        resetDialog();
        onOpenChange(false);
        setLoading(false);

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
                                Enter the 8-character invite code to join a household
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="invite-code">Invite Code</Label>
                                <Input
                                    id="invite-code"
                                    placeholder="ABCD2345"
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                    maxLength={8}
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
                            <Button onClick={handleValidateCode} disabled={loading || inviteCode.length !== 8}>
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
                                <h4 className="text-sm mb-3">Current Members ({members.length})</h4>
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
