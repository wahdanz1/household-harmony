import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useToast } from "@/hooks/use-toast";
import { passwordSchema } from "@/config/passwordSchema";
import { JoinStepCode } from "./join/JoinStepCode";
import { JoinStepPreview, type PreviewMember } from "./join/JoinStepPreview";
import { JoinStepSignup } from "./join/JoinStepSignup";
import { JoinInFlightView, JoinErrorView } from "./join/JoinPhaseView";

interface JoinHouseholdWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type JoinPhase =
    | { kind: "idle" }
    | { kind: "joining"; message: string }
    | { kind: "settling"; expected: { userId: string; householdId: string } }
    | { kind: "error"; message: string };

interface PreviewedHousehold {
    id: string;
    name: string;
    currency: string;
    invited_email: string | null;
    encrypted_dek: string;
    dek_iv: string;
    dek_salt: string;
}

export const JoinHouseholdWizard = ({ open, onOpenChange }: JoinHouseholdWizardProps) => {
    const { user, signUpAndJoinHousehold } = useAuth();
    const { setupVaultFromInvite, isUnlocked } = useEncryption();
    const { household: activeHousehold, refresh: refreshHousehold } = useHousehold();
    const { toast } = useToast();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [phase, setPhase] = useState<JoinPhase>({ kind: "idle" });

    const [inviteCode, setInviteCode] = useState("");
    const [household, setHousehold] = useState<PreviewedHousehold | null>(null);
    const [members, setMembers] = useState<PreviewMember[]>([]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            members: Array<{ role: string; full_name: string | null; avatar_url: string | null }>;
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
        if (!household) return;

        if (!fullName || !email || !password) {
            toast({
                title: "Missing Information",
                description: "Please fill in all fields",
                variant: "destructive",
            });
            return;
        }

        if (household.invited_email && email.toLowerCase() !== household.invited_email.toLowerCase()) {
            toast({
                title: "Email Mismatch",
                description: `This invite is for ${household.invited_email}. Please use the correct email address.`,
                variant: "destructive",
            });
            return;
        }

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

        // Hand off to the invariant-watcher above; it closes only once auth,
        // household, and vault have all caught up.
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
        <Dialog open={open} onOpenChange={(next) => {
            if (inFlight) return;
            onOpenChange(next);
            if (!next) resetWizard();
        }}>
            <DialogContent
                className="sm:max-w-[500px]"
                hideClose={inFlight}
                onPointerDownOutside={(e) => { if (inFlight) e.preventDefault(); }}
                onEscapeKeyDown={(e) => { if (inFlight) e.preventDefault(); }}
            >
                {inFlight ? (
                    <JoinInFlightView message={inFlightMessage} />
                ) : phase.kind === "error" ? (
                    <JoinErrorView
                        message={phase.message}
                        onClose={() => onOpenChange(false)}
                        onRetry={() => setPhase({ kind: "idle" })}
                    />
                ) : step === 1 ? (
                    <JoinStepCode
                        inviteCode={inviteCode}
                        setInviteCode={setInviteCode}
                        loading={loading}
                        onCancel={() => onOpenChange(false)}
                        onContinue={handleValidateCode}
                    />
                ) : step === 2 && household ? (
                    <JoinStepPreview
                        householdName={household.name}
                        members={members}
                        onBack={() => setStep(1)}
                        onContinue={() => setStep(3)}
                    />
                ) : step === 3 && household ? (
                    <JoinStepSignup
                        householdName={household.name}
                        fullName={fullName}
                        setFullName={setFullName}
                        email={email}
                        setEmail={setEmail}
                        password={password}
                        setPassword={setPassword}
                        confirmPassword={confirmPassword}
                        setConfirmPassword={setConfirmPassword}
                        loading={loading}
                        onBack={() => setStep(2)}
                        onSignUp={handleSignUp}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
};
