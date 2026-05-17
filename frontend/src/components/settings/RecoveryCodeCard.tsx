import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KeyRound, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryption, PreparedRecoverySlot } from "@/contexts/EncryptionContext";
import { RecoveryCodeSetupModal } from "@/components/auth/RecoveryCodeSetupModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";

export const RecoveryCodeCard = () => {
    const { user } = useAuth();
    const { isUnlocked, prepareRecoveryCode, persistRecoveryCode } = useEncryption();
    const [exists, setExists] = useState<boolean | null>(null);
    const [createdAt, setCreatedAt] = useState<string | null>(null);
    const [slot, setSlot] = useState<PreparedRecoverySlot | null>(null);
    const [confirmRegen, setConfirmRegen] = useState(false);
    const [busy, setBusy] = useState(false);

    const fetchStatus = async () => {
        if (!user?.id) return;
        const { data } = await (supabase as any)
            .from("user_vault_recovery_slots")
            .select("created_at")
            .eq("user_id", user.id)
            .eq("slot_type", "recovery_code")
            .maybeSingle();
        setExists(!!data);
        setCreatedAt(data?.created_at ?? null);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchStatus(); }, [user?.id]);

    const startRegen = async () => {
        if (!isUnlocked) {
            toast.error("Unlock your vault first");
            return;
        }
        setBusy(true);
        const prepared = await prepareRecoveryCode();
        setBusy(false);
        if (!prepared) {
            toast.error("Couldn't prepare recovery code");
            return;
        }
        setSlot(prepared);
    };

    const handleConfirm = async () => {
        if (!user?.id || !slot) return;
        setBusy(true);
        const ok = await persistRecoveryCode(user.id, slot);
        setBusy(false);
        if (!ok) {
            toast.error("Couldn't save recovery code");
            return;
        }
        toast.success("Recovery code saved");
        setSlot(null);
        fetchStatus();
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5 text-accent" />
                        Recovery code
                    </CardTitle>
                    <CardDescription>
                        A 12-word phrase that lets you recover your encrypted data if you forget your password.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {exists === null ? (
                        <p className="text-sm text-muted">Loading…</p>
                    ) : exists ? (
                        <>
                            <div className="flex items-center gap-2 text-sm text-accent">
                                <ShieldCheck className="h-4 w-4" />
                                <span>Recovery code set{createdAt ? ` on ${new Date(createdAt).toLocaleDateString()}` : ""}.</span>
                            </div>
                            <p className="text-xs text-muted">
                                You can't view the code again. Regenerate to replace it with a new one — the old code stops working.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => setConfirmRegen(true)}
                                disabled={busy || !isUnlocked}
                            >
                                <RefreshCw className="h-4 w-4" />
                                Regenerate
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className="flex items-start gap-2 p-3 rounded-[10px] bg-warn/10 text-warn-dk text-xs">
                                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>No recovery code set yet. Without one, a forgotten password means losing access to your encrypted data.</span>
                            </div>
                            <Button onClick={startRegen} disabled={busy || !isUnlocked} className="gap-2">
                                <KeyRound className="h-4 w-4" />
                                Generate recovery code
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>

            <RecoveryCodeSetupModal
                open={!!slot}
                code={slot?.code ?? null}
                onConfirm={handleConfirm}
            />

            <ConfirmDialog
                open={confirmRegen}
                onOpenChange={setConfirmRegen}
                title="Regenerate recovery code?"
                description="Your existing code will stop working. Make sure you have access to set the new one somewhere safe."
                confirmLabel="Regenerate"
                onConfirm={() => { setConfirmRegen(false); startRegen(); }}
            />
        </>
    );
};
