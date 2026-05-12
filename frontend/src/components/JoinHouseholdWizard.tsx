import { useEffect, useState } from "react";
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
import { Check, Users, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { PLACEHOLDERS } from "@/constants/ui";
import { passwordSchema } from "@/config/passwordSchema";

interface JoinHouseholdWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type JoinPhase =
    | { kind: "idle" }
    | { kind: "joining"; message: string }
    | { kind: "settling"; expected: { userId: string; householdId: string } }
    | { kind: "error"; message: string };

export const JoinHouseholdWizard = ({ open, onOpenChange }: JoinHouseholdWizardProps) => {
    const { user, signUpAndJoinHousehold } = useAuth();
    const { setupVaultFromInvite, isUnlocked } = useEncryption();
    const { household: activeHousehold, refresh: refreshHousehold } = useHousehold();
    const { toast } = useToast();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [phase, setPhase] = useState<JoinPhase>({ kind: "idle" });

    const [inviteCode, setInviteCode] = useState("");

    const [household, setHousehold] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const resetWizard = () => {
        setStep(1);
        setInviteCode("");
        setHousehold(null);
        setMembers([]);
        setFullName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setPhase({ kind: "idle" });
    };

    useEffect(() => {
        if (phase.kind !== "settling") return;
        const { userId, householdId } = phase.expected;
        const userMatch = user?.id === userId;
        const householdMatch = activeHousehold?.id === householdId;

        // eslint-disable-next-line no-console
        console.debug("[JoinWizard] settling check", {
            userMatch, expectedUser: userId, actualUser: user?.id,
            householdMatch, expectedHousehold: householdId, actualHousehold: activeHousehold?.id,
            isUnlocked,
        });

        if (!userMatch || !householdMatch || !isUnlocked) return;

        toast({
            title: "Account Created!",
            description: `You've joined ${household?.name ?? "the household"}.`,
        });
        resetWizard();
        onOpenChange(false);
    }, [phase, user?.id, activeHousehold?.id, isUnlocked]);

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
            encrypted_dek: string | null;
            dek_iv: string | null;
            dek_salt: string | null;
            members: Array<{
                role: string;
                full_name: string | null;
                avatar_url: string | null;
            }>;
        };

        if (!preview.encrypted_dek || !preview.dek_iv || !preview.dek_salt) {
            toast({
                title: "Invite outdated",
                description: "This invite was created before encrypted sharing was set up. Ask the inviter to send a new one.",
                variant: "destructive",
            });
            setLoading(false);
            return;
        }

        setHousehold({
            id: preview.household_id,
            name: preview.household_name,
            currency: preview.household_currency,
            invited_email: preview.invited_email,
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

        if (preview.invited_email) {
            setEmail(preview.invited_email);
        }

        setStep(2);
        setLoading(false);
    };

    const handleSignUp = async () => {
        if (!fullName || !email || !password) {
            toast({
                title: "Missing Information",
                description: "Please fill in all fields",
                variant: "destructive",
            });
            return;
        }

        if (household?.invited_email && email.toLowerCase() !== household.invited_email.toLowerCase()) {
            toast({
                title: "Email Mismatch",
                description: `This invite is for ${household.invited_email}. Please use the correct email address.`,
                variant: "destructive",
            });
            return;
        }

        // Invite IS the authorization here — don't double-gate behind the
        // whitelist that's meant for unsolicited signups.

        if (password !== confirmPassword) {
            toast({
                title: "Password Mismatch",
                description: "Passwords do not match",
                variant: "destructive",
            });
            return;
        }

        const passwordCheck = passwordSchema.safeParse(password);
        if (!passwordCheck.success) {
            toast({
                title: "Weak Password",
                description: passwordCheck.error.errors[0].message,
                variant: "destructive",
            });
            return;
        }

        setLoading(true);
        setPhase({ kind: "joining", message: "Creating your account…" });

        const { error, userId, householdId } = await signUpAndJoinHousehold(email, password, fullName, inviteCode);

        if (error) {
            const message =
                error.message === "email_mismatch"
                    ? "This invite is for a different email address."
                    : error.message === "invite_not_found"
                    ? "This invite is no longer valid."
                    : error.message === "already_member"
                    ? "You are already a member of this household."
                    : error.message || "Failed to create account";
            setPhase({ kind: "error", message });
            setLoading(false);
            return;
        }

        if (!userId || !householdId) {
            setPhase({ kind: "error", message: "Account created but the invite could not be redeemed." });
            setLoading(false);
            return;
        }

        if (!household.encrypted_dek || !household.dek_iv || !household.dek_salt) {
            setPhase({ kind: "error", message: "Invite is missing the shared encryption key. Ask for a new one." });
            setLoading(false);
            return;
        }

        setPhase({ kind: "joining", message: "Setting up your secure vault…" });

        const vaultOk = await setupVaultFromInvite({
            userId,
            householdId,
            password,
            inviteCode,
            wrappedDEK: {
                encryptedDEK: household.encrypted_dek,
                dekSalt: household.dek_salt,
                dekIV: household.dek_iv,
            },
        });
        if (!vaultOk) {
            setPhase({ kind: "error", message: "Your account was created but encryption setup failed. Contact the household owner." });
            setLoading(false);
            return;
        }

        setPhase({ kind: "joining", message: "Loading your household…" });
        await refreshHousehold();

        // Hand off to the invariant-watcher effect; it closes the wizard only
        // once auth, household, and vault have all caught up.
        setPhase({ kind: "settling", expected: { userId, householdId } });
        setLoading(false);
    };

    const inFlight = phase.kind === "joining" || phase.kind === "settling";
    const inFlightMessage = phase.kind === "joining"
        ? phase.message
        : phase.kind === "settling"
            ? "Settling you into your household…"
            : "";

    return (
        <Dialog open={open} onOpenChange={(open) => {
            if (inFlight) return; // Block dismissal mid-flight.
            onOpenChange(open);
            if (!open) resetWizard();
        }}>
            <DialogContent
                className="sm:max-w-[500px]"
                hideClose={inFlight}
                onPointerDownOutside={(e) => { if (inFlight) e.preventDefault(); }}
                onEscapeKeyDown={(e) => { if (inFlight) e.preventDefault(); }}
            >
                {inFlight ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-accent" />
                        <p className="text-sm text-muted-foreground">
                            {inFlightMessage}
                        </p>
                    </div>
                ) : phase.kind === "error" ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Something went wrong</DialogTitle>
                            <DialogDescription>{phase.message}</DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                            <Button onClick={() => setPhase({ kind: "idle" })}>Try again</Button>
                        </DialogFooter>
                    </>
                ) : step === 1 ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Join Existing Household</DialogTitle>
                            <DialogDescription>
                                Enter the 8-character invite code you received
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
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleValidateCode} disabled={loading || inviteCode.length !== 8}>
                                {loading ? "Validating..." : "Continue"}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </DialogFooter>
                    </>
                ) : step === 2 && household ? (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                {household.name}
                            </DialogTitle>
                            <DialogDescription>
                                You're about to join this household
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
                            <Button onClick={() => setStep(3)}>
                                Continue to Sign Up
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </DialogFooter>
                    </>
                ) : step === 3 ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Create Your Account</DialogTitle>
                            <DialogDescription>
                                You'll join {household?.name} after creating your account
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <Input
                                    id="fullName"
                                    placeholder="John Doe"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder={PLACEHOLDERS.EMAIL}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setStep(2)}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                            <Button onClick={handleSignUp} disabled={loading}>
                                {loading ? "Creating Account..." : "Create Account & Join"}
                            </Button>
                        </DialogFooter>
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    );
};
