import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryption, PreparedRecoverySlot } from "@/contexts/EncryptionContext";
import { isDemoMode } from "@/utils/demoMode";
import { RecoveryCodeSetupModal } from "./RecoveryCodeSetupModal";
import { toast } from "sonner";

export const RecoveryCodeGate = () => {
    const { user } = useAuth();
    const { isUnlocked, hasRecoveryCode, prepareRecoveryCode, persistRecoveryCode } = useEncryption();
    const [slot, setSlot] = useState<PreparedRecoverySlot | null>(null);
    const [persisting, setPersisting] = useState(false);
    const [checkedThisSession, setCheckedThisSession] = useState(false);

    useEffect(() => {
        if (!user?.id || !isUnlocked || checkedThisSession || isDemoMode()) return;
        let cancelled = false;
        (async () => {
            const exists = await hasRecoveryCode(user.id);
            if (cancelled || exists) {
                if (!cancelled) setCheckedThisSession(true);
                return;
            }
            const prepared = await prepareRecoveryCode();
            if (cancelled) return;
            if (!prepared) {
                toast.error("Couldn't prepare recovery code");
                setCheckedThisSession(true);
                return;
            }
            setSlot(prepared);
            setCheckedThisSession(true);
        })();
        return () => { cancelled = true; };
    }, [user?.id, isUnlocked, checkedThisSession, hasRecoveryCode, prepareRecoveryCode]);

    const handleConfirm = async () => {
        if (!user?.id || !slot) return;
        setPersisting(true);
        const ok = await persistRecoveryCode(user.id, slot);
        setPersisting(false);
        if (!ok) {
            toast.error("Couldn't save recovery code — try again");
            return;
        }
        toast.success("Recovery code saved");
        setSlot(null);
    };

    return (
        <RecoveryCodeSetupModal
            open={!!slot}
            code={slot?.code ?? null}
            onConfirm={handleConfirm}
        />
    );
};
