import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useToast } from "@/hooks/use-toast";
import { unlockVault } from "@/services/encryption";
import { Check, Users, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";

interface JoinExistingUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

interface PreviewedHousehold {
    id: string;
    name: string;
    currency: string;
    encrypted_dek: string;
    dek_iv: string;
    dek_salt: string;
}

interface PreviewMember {
    id: string;
    role: string;
    profiles?: { full_name?: string | null; avatar_url?: string | null };
}

export const JoinExistingUserDialog = ({ open, onOpenChange }: JoinExistingUserDialogProps) => {
    const { user } = useAuth();
    const { setupVaultFromInvite } = useEncryption();
    const { household: currentHousehold } = useHousehold();
    const { toast } = useToast();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [inviteCode, setInviteCode] = useState("");
    const [household, setHousehold] = useState<PreviewedHousehold | null>(null);
    const [members, setMembers] = useState<PreviewMember[]>([]);
    const [password, setPassword] = useState("");

    const resetDialog = () => {
        setStep(1);
        setInviteCode("");
        setHousehold(null);
        setMembers([]);
        setPassword("");
    };

    const handleValidateCode = async () => {
        if (!inviteCode || inviteCode.length !== 8) {
            toast({ title: "Invalid Code", description: "Please enter a valid 8-character invite code", variant: "destructive" });
            return;
        }

        setLoading(true);

        const { data, error } = await supabase.rpc("lookup_active_invite", {
            invite_code_in: inviteCode.toUpperCase(),
        });

        if (error || !data) {
            toast({ title: "Invalid Code", description: "This invite code is invalid or has expired", variant: "destructive" });
            setLoading(false);
            return;
        }

        const preview = data as {
            household_id: string;
            household_name: string;
            household_currency: string;
            encrypted_dek: string | null;
            dek_iv: string | null;
            dek_salt: string | null;
            members: Array<{ role: string; full_name: string | null; avatar_url: string | null }>;
        };

        if (!preview.encrypted_dek || !preview.dek_iv || !preview.dek_salt) {
            toast({
                title: "Invite outdated",
                description: "This invite is missing the shared encryption key. Ask for a new one.",
                variant: "destructive",
            });
            setLoading(false);
            return;
        }

        const { data: existingMember } = await supabase
            .from("household_members")
            .select("id, pending_exit_at")
            .eq("household_id", preview.household_id)
            .eq("user_id", user?.id)
            .maybeSingle();

        if (existingMember && !existingMember.pending_exit_at) {
            toast({ title: "Already a Member", description: "You're already a member of this household", variant: "destructive" });
            setLoading(false);
            return;
        }

        setHousehold({
            id: preview.household_id,
            name: preview.household_name,
            currency: preview.household_currency,
            encrypted_dek: preview.encrypted_dek,
            dek_iv: preview.dek_iv,
            dek_salt: preview.dek_salt,
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

    const handleSwitch = async () => {
        if (!user || !household || !currentHousehold) return;
        if (!password) {
            toast({ title: "Password required", description: "Enter your password to set up the new vault.", variant: "destructive" });
            return;
        }

        setLoading(true);

        // Verify password against the user's current household vault before
        // doing anything else — otherwise a wrong password would silently
        // store an unrecoverable wrap on the new household's key.
        const { data: currentVault } = await (supabase as any)
            .from("user_vault_keys")
            .select("encrypted_dek, dek_salt, dek_iv")
            .eq("user_id", user.id)
            .eq("household_id", currentHousehold.id)
            .maybeSingle();
        if (!currentVault?.encrypted_dek) {
            toast({ title: "Couldn't verify", description: "Your current vault key is missing.", variant: "destructive" });
            setLoading(false);
            return;
        }
        try {
            await unlockVault(password, currentVault.encrypted_dek, currentVault.dek_salt, currentVault.dek_iv);
        } catch {
            toast({ title: "Wrong password", description: "That password doesn't match your account.", variant: "destructive" });
            setLoading(false);
            return;
        }

        const { data: redeem, error: redeemError } = await supabase.rpc("redeem_invite", {
            invite_code_in: inviteCode.toUpperCase(),
        });
        if (redeemError) {
            toast({
                title: "Couldn't join",
                description: redeemError.message === "email_mismatch" ? "This invite is for a different email address."
                    : redeemError.message === "invite_not_found" ? "This invite is no longer valid."
                    : redeemError.message === "already_member" ? "You're already a member."
                    : "Failed to join household",
                variant: "destructive",
            });
            setLoading(false);
            return;
        }
        const redeemedHouseholdId = (redeem as { household_id?: string } | null)?.household_id ?? household.id;

        const vaultOk = await setupVaultFromInvite({
            userId: user.id,
            householdId: redeemedHouseholdId,
            password,
            inviteCode,
            wrappedDEK: {
                encryptedDEK: household.encrypted_dek,
                dekSalt: household.dek_salt,
                dekIV: household.dek_iv,
            },
        });
        if (!vaultOk) {
            toast({
                title: "Vault setup failed",
                description: "Password may be wrong, or the invite's encryption key didn't unwrap. Try again.",
                variant: "destructive",
            });
            setLoading(false);
            return;
        }

        // Soft-leave current household so the bring-items dialog runs on reload.
        const { data: currentMembership } = await supabase
            .from("household_members")
            .select("id")
            .eq("user_id", user.id)
            .eq("household_id", currentHousehold.id)
            .maybeSingle();
        if (currentMembership) {
            const { error: exitError } = await (supabase as any).rpc("request_member_exit", {
                member_id_in: currentMembership.id,
            });
            if (exitError && exitError.message === "owner_must_transfer_first") {
                toast({
                    title: "Transfer ownership first",
                    description: "You own your current household with other members. Transfer ownership before switching.",
                    variant: "destructive",
                });
                setLoading(false);
                return;
            }
        }

        toast({
            title: "Switching households…",
            description: `Joining ${household.name}. Reloading.`,
        });
        setTimeout(() => window.location.reload(), 1000);
    };

    return (
        <Dialog open={open} onOpenChange={(next) => {
            if (loading) return;
            onOpenChange(next);
            if (!next) resetDialog();
        }}>
            <DialogContent className="sm:max-w-[500px]" hideClose={loading}>
                {step === 1 && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Switch to Another Household</DialogTitle>
                            <DialogDescription>
                                Enter the 8-character invite code to join a household. You'll leave your current one;
                                items you've added can be brought along on the next page.
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
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
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
                            <DialogDescription>Review the household before switching.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <h4 className="text-sm mb-3">Current Members ({members.length})</h4>
                                <div className="space-y-2">
                                    {members.map((member) => (
                                        <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg border">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={member.profiles?.avatar_url ?? undefined} />
                                                <AvatarFallback>
                                                    {member.profiles?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "?"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <p className="font-medium">{member.profiles?.full_name || "Unknown"}</p>
                                                <p className="text-xs text-muted capitalize">{member.role}</p>
                                            </div>
                                            {member.role === "owner" && <Check className="h-4 w-4 text-accent" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                            <Button onClick={() => setStep(3)}>
                                Continue
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {step === 3 && household && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Confirm with your password</DialogTitle>
                            <DialogDescription>
                                Your password unlocks the new household's encryption. After switching, the bring-items
                                dialog will let you pick what to take from {currentHousehold?.name}.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="switch-password">Password</Label>
                                <Input
                                    id="switch-password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setStep(2)} disabled={loading}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                            <Button onClick={handleSwitch} disabled={loading || !password}>
                                {loading ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Switching…</>
                                ) : (
                                    <>Switch to {household.name}</>
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
