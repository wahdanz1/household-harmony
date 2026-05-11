import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { isValidRecoveryCode } from "@/services/encryption";

interface RecoverPasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultEmail?: string;
    onRecovered?: (email: string, newPassword: string) => void;
}

export const RecoverPasswordDialog = ({
    open, onOpenChange, defaultEmail = "", onRecovered,
}: RecoverPasswordDialogProps) => {
    const [email, setEmail] = useState(defaultEmail);
    const [recoveryCode, setRecoveryCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const reset = () => {
        setRecoveryCode("");
        setNewPassword("");
        setConfirmPassword("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !recoveryCode || !newPassword) return;
        if (newPassword !== confirmPassword) {
            toast.error("Passwords don't match");
            return;
        }
        if (newPassword.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }
        const valid = await isValidRecoveryCode(recoveryCode);
        if (!valid) {
            toast.error("That doesn't look like a valid 12-word recovery phrase");
            return;
        }

        setSubmitting(true);
        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
            const res = await fetch(`${backendUrl}/api/auth/recover-with-code`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.trim(),
                    recovery_code: recoveryCode.trim(),
                    new_password: newPassword,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                toast.error(body.detail || "Couldn't recover account");
                return;
            }
            toast.success("Password reset — signing you in…");
            const submittedPassword = newPassword;
            const submittedEmail = email.trim();
            reset();
            onOpenChange(false);
            onRecovered?.(submittedEmail, submittedPassword);
        } catch {
            toast.error("Network error — try again");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center mb-2">
                        <KeyRound className="h-6 w-6 text-accent-dk" />
                    </div>
                    <DialogTitle>Recover with code</DialogTitle>
                    <DialogDescription>
                        Enter the 12-word recovery phrase you saved when setting up your account.
                        Your encrypted data stays intact.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="recover-email">Email</Label>
                        <Input
                            id="recover-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            disabled={submitting}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="recover-code">Recovery phrase</Label>
                        <Textarea
                            id="recover-code"
                            rows={3}
                            placeholder="twelve lowercase words separated by spaces"
                            value={recoveryCode}
                            onChange={(e) => setRecoveryCode(e.target.value)}
                            required
                            autoComplete="off"
                            disabled={submitting}
                            className="font-mono text-sm"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="recover-new-password">New password</Label>
                        <Input
                            id="recover-new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                            disabled={submitting}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="recover-confirm">Confirm new password</Label>
                        <Input
                            id="recover-confirm"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                            disabled={submitting}
                        />
                    </div>

                    <div className="flex items-start gap-2 p-3 rounded-[10px] bg-warning/10 text-warning-dk text-xs">
                        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>After resetting, set up a new recovery code in Settings — your old phrase keeps working until you do.</span>
                    </div>

                    <Button type="submit" size="lg" className="w-full gap-2" disabled={submitting}>
                        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Recovering…</> : "Reset password"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
};
