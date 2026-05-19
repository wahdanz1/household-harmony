/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
    encrypt as encryptValue,
    decrypt as decryptValue,
    createUserEncryptionKeys,
    unlockVault,
    reEncryptDEK,
    generateRecoveryCode,
    wrapDEKWithRecoveryCode,
    wrapDEKWithInviteCode,
    unwrapDEKWithInviteCode,
    rewrapDEKWithPassword,
} from '@/services/encryption';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface EncryptionContextValue {
    isUnlocked: boolean;
    isLoading: boolean;
    encrypt: (plaintext: string) => Promise<string | null>;
    decrypt: (ciphertext: string) => Promise<string | null>;

    initializeEncryption: (password: string, userId: string, householdId: string) => Promise<boolean>;
    unlockWithPassword: (password: string, userId: string) => Promise<boolean>;
    setupVaultFromInvite: (params: SetupVaultFromInviteParams) => Promise<boolean>;

    lockVault: () => void;
    changePassword: (oldPassword: string, newPassword: string, userId: string) => Promise<boolean>;
    resetInactivityTimer: () => void;

    prepareRecoveryCode: () => Promise<PreparedRecoverySlot | null>;
    persistRecoveryCode: (userId: string, slot: PreparedRecoverySlot) => Promise<boolean>;
    hasRecoveryCode: (userId: string) => Promise<boolean>;
    wrapDEKForInvite: (inviteCode: string) => Promise<{ encryptedDEK: string; salt: string; iv: string } | null>;

    /** The household the user has been soft-removed from. Null when no pending exit. */
    pendingExitHouseholdId: string | null;
    /** Decrypt a ciphertext using the soft-removed household's DEK. */
    decryptFromPendingExit: (ciphertext: string) => Promise<string | null>;
    /** Drop the pending-exit DEK from memory (call after the exit dialog completes). */
    clearPendingExitDEK: () => void;
    /** Stash an already-unlocked household's DEK as the pending-exit DEK.
     *  Used by the join-an-existing-household flow so the old household's DEK
     *  survives the in-place switch without a page reload. */
    markPendingExit: (householdId: string, dek: CryptoKey) => void;

    /** True while the first-run recovery-code modal is on screen. Other welcome flows
     *  (HouseholdSetupWizard) gate themselves on this so they don't render on top. */
    recoveryCodeDialogOpen: boolean;
    setRecoveryCodeDialogOpen: (open: boolean) => void;
}

export interface PreparedRecoverySlot {
    code: string;
    encryptedDEK: string;
    salt: string;
    iv: string;
}

export interface SetupVaultFromInviteParams {
    userId: string;
    householdId: string;
    password: string;
    inviteCode: string;
    wrappedDEK: { encryptedDEK: string; dekSalt: string; dekIV: string };
}

const EncryptionContext = createContext<EncryptionContextValue | null>(null);

const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
const LOCK_WARNING_TIME = 60 * 1000;

interface EncryptionProviderProps {
    children: React.ReactNode;
}

async function resolveActiveHouseholdId(userId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('household_members')
        .select('household_id, role, pending_exit_at')
        .eq('user_id', userId);
    if (error) {
        console.error('Failed to resolve household_id for vault:', error);
        return null;
    }
    if (!data || data.length === 0) return null;
    const active = data.filter((m: any) => !m.pending_exit_at);
    // If every membership is pending exit, the user has nowhere active to
    // land — return null and let the caller bootstrap a personal household.
    if (active.length === 0) return null;
    const chosen = active.find((m: any) => m.role === 'member') ?? active.find((m: any) => m.role === 'owner') ?? active[0];
    return chosen?.household_id ?? null;
}

export function EncryptionProvider({ children }: EncryptionProviderProps) {
    const dekRef = useRef<CryptoKey | null>(null);
    // The user the in-memory DEK belongs to. Lets the auth-change listener
    // distinguish "stale DEK from a different user" (lock) from "DEK just set
    // up for the user we're transitioning into" (don't lock).
    const dekUserIdRef = useRef<string | null>(null);
    const pendingExitDekRef = useRef<CryptoKey | null>(null);
    const [pendingExitHouseholdId, setPendingExitHouseholdId] = useState<string | null>(null);
    const [recoveryCodeDialogOpen, setRecoveryCodeDialogOpen] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
    const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [secondsUntilLock, setSecondsUntilLock] = useState(Math.ceil(LOCK_WARNING_TIME / 1000));
    const [showLockWarning, setShowLockWarning] = useState(false);
    const autoLockDisabledRef = useRef(false);

    useEffect(() => {
        return () => {
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        };
    }, []);

    // Drop the DEK whenever it belongs to a different user than the current session.
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const nextId = session?.user?.id ?? null;
            if (dekUserIdRef.current && dekUserIdRef.current !== nextId) {
                dekRef.current = null;
                dekUserIdRef.current = null;
                pendingExitDekRef.current = null;
                setPendingExitHouseholdId(null);
                setIsUnlocked(false);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const autoUnlockDemo = async () => {
            const { isDemoMode } = await import('@/utils/demoMode');

            const demoPassword = sessionStorage.getItem('demo_password');
            if (!isDemoMode() || isUnlocked || !demoPassword) {
                return;
            }

            const authData = await supabase.auth.getUser();
            if (!authData.data.user) return;

            const userId = authData.data.user.id;
            const householdId = await resolveActiveHouseholdId(userId);
            if (!householdId) return;

            const { unlockVault: unlockFn } = await import('@/services/encryption');

            try {
                const { data: vault } = await (supabase as any)
                    .from('user_vault_keys')
                    .select('encrypted_dek, dek_salt, dek_iv')
                    .eq('user_id', userId)
                    .eq('household_id', householdId)
                    .maybeSingle();

                if (vault?.encrypted_dek) {
                    const dek = await unlockFn(demoPassword, vault.encrypted_dek, vault.dek_salt, vault.dek_iv);
                    dekRef.current = dek;
                    dekUserIdRef.current = userId;
                    setIsUnlocked(true);
                }
            } catch (error) {
                console.warn('Demo vault auto-unlock failed:', error);
            }
        };

        autoUnlockDemo();
    }, [isUnlocked]);

    const resetInactivityTimer = useCallback(() => {
        setShowLockWarning(false);

        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);

        if (!isUnlocked || autoLockDisabledRef.current) return;

        warningTimerRef.current = setTimeout(() => {
            setShowLockWarning(true);
        }, INACTIVITY_TIMEOUT - LOCK_WARNING_TIME);

        inactivityTimerRef.current = setTimeout(() => {
            if (!autoLockDisabledRef.current) {
                lockVault();
                toast({
                    title: 'Vault locked',
                    description: 'Locked due to inactivity. Unlock to continue.',
                    duration: 8000,
                });
            }
        }, INACTIVITY_TIMEOUT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isUnlocked]);

    useEffect(() => {
        if (!isUnlocked) return;
        const handler = () => resetInactivityTimer();
        // mousemove omitted on purpose — fires too often, would make the
        // inactivity lock unreachable.
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;
        for (const e of events) window.addEventListener(e, handler, { passive: true });
        return () => {
            for (const e of events) window.removeEventListener(e, handler);
        };
    }, [isUnlocked, resetInactivityTimer]);

    useEffect(() => {
        const reset = Math.ceil(LOCK_WARNING_TIME / 1000);
        if (!showLockWarning) {
            setSecondsUntilLock(reset);
            return;
        }
        setSecondsUntilLock(reset);
        const id = setInterval(() => {
            setSecondsUntilLock(s => Math.max(0, s - 1));
        }, 1000);
        return () => clearInterval(id);
    }, [showLockWarning]);


    const lockVault = useCallback(() => {
        dekRef.current = null;
        dekUserIdRef.current = null;
        pendingExitDekRef.current = null;
        setPendingExitHouseholdId(null);
        setIsUnlocked(false);
        setShowLockWarning(false);
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    }, []);

    const decryptFromPendingExit = useCallback(async (ciphertext: string): Promise<string | null> => {
        if (!pendingExitDekRef.current) return null;
        try {
            return await decryptValue(ciphertext, pendingExitDekRef.current);
        } catch (err) {
            console.error('Failed to decrypt pending-exit ciphertext:', err);
            return null;
        }
    }, []);

    const clearPendingExitDEK = useCallback(() => {
        pendingExitDekRef.current = null;
        setPendingExitHouseholdId(null);
    }, []);

    const markPendingExit = useCallback((householdId: string, dek: CryptoKey) => {
        pendingExitDekRef.current = dek;
        setPendingExitHouseholdId(householdId);
    }, []);

    const encrypt = useCallback(async (plaintext: string): Promise<string | null> => {
        if (!dekRef.current) {
            console.warn('Encryption attempted while vault is locked');
            return null;
        }
        try {
            return await encryptValue(plaintext, dekRef.current);
        } catch (error) {
            console.error('Encryption failed:', error);
            return null;
        }
    }, []);

    const decrypt = useCallback(async (ciphertext: string): Promise<string | null> => {
        if (!dekRef.current) {
            console.warn('Decryption attempted while vault is locked');
            return null;
        }
        try {
            return await decryptValue(ciphertext, dekRef.current);
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }, []);

    const initializeEncryption = useCallback(async (
        password: string,
        userId: string,
        householdId: string,
    ): Promise<boolean> => {
        setIsLoading(true);
        try {
            const { encryptedDEK, dekSalt, dekIV, dek } = await createUserEncryptionKeys(password);

            const { error } = await (supabase as any)
                .from('user_vault_keys')
                .upsert({
                    user_id: userId,
                    household_id: householdId,
                    encrypted_dek: encryptedDEK,
                    dek_salt: dekSalt,
                    dek_iv: dekIV,
                    encryption_version: 1,
                });

            if (error) {
                console.error('Failed to store encryption keys:', error);
                return false;
            }

            dekRef.current = dek;
            dekUserIdRef.current = userId;
            setIsUnlocked(true);
            resetInactivityTimer();

            return true;
        } catch (error) {
            console.error('Failed to initialize encryption:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [resetInactivityTimer]);

    const unlockWithPassword = useCallback(async (password: string, userId: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            let householdId = await resolveActiveHouseholdId(userId);
            if (!householdId) {
                // Stranded user (e.g. removed from the only household they joined).
                // Provision a personal household via the RPC and continue.
                const { data: bootstrappedId, error: bootstrapError } = await (supabase as any).rpc('ensure_user_has_household');
                if (bootstrapError || !bootstrappedId) {
                    console.error('Failed to provision a household for stranded user:', bootstrapError);
                    return false;
                }
                householdId = bootstrappedId as string;
            }

            const { data: vault, error } = await (supabase as any)
                .from('user_vault_keys')
                .select('encrypted_dek, dek_salt, dek_iv')
                .eq('user_id', userId)
                .eq('household_id', householdId)
                .maybeSingle();

            if (error) {
                console.error('Failed to fetch encryption keys:', error);
                return false;
            }

            let unlocked = false;
            if (!vault?.encrypted_dek) {
                // Only auto-init when nobody in the household has a wrap yet —
                // otherwise we'd fork the DEK and orphan existing data.
                const { data: hasKeys } = await (supabase as any).rpc('household_has_any_vault_keys', {
                    household_id_in: householdId,
                });
                if (hasKeys === false) {
                    unlocked = await initializeEncryption(password, userId, householdId);
                }
            } else {
                const dek = await unlockVault(
                    password,
                    vault.encrypted_dek,
                    vault.dek_salt,
                    vault.dek_iv,
                );
                dekRef.current = dek;
                dekUserIdRef.current = userId;
                setIsUnlocked(true);
                resetInactivityTimer();
                unlocked = true;
            }

            if (!unlocked) return false;

            // Pending-exit detection runs regardless of which unlock path fired
            // — a stranded user who just bootstrapped their fresh household
            // still needs the bring-items dialog to surface for the household
            // they were kicked from.
            const { data: pendingMembership } = await (supabase as any)
                .from('household_members')
                .select('household_id')
                .eq('user_id', userId)
                .not('pending_exit_at', 'is', null)
                .limit(1)
                .maybeSingle();
            if (pendingMembership?.household_id) {
                const { data: pendingVault } = await (supabase as any)
                    .from('user_vault_keys')
                    .select('encrypted_dek, dek_salt, dek_iv')
                    .eq('user_id', userId)
                    .eq('household_id', pendingMembership.household_id)
                    .maybeSingle();
                if (pendingVault?.encrypted_dek) {
                    try {
                        const pendingDek = await unlockVault(
                            password,
                            pendingVault.encrypted_dek,
                            pendingVault.dek_salt,
                            pendingVault.dek_iv,
                        );
                        pendingExitDekRef.current = pendingDek;
                        setPendingExitHouseholdId(pendingMembership.household_id);
                    } catch (err) {
                        console.error('Failed to unlock pending-exit vault:', err);
                    }
                }
            }

            return true;
        } catch (error) {
            console.error('Failed to unlock vault:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [resetInactivityTimer, initializeEncryption]);

    const setupVaultFromInvite = useCallback(async ({
        userId,
        householdId,
        password,
        inviteCode,
        wrappedDEK,
    }: SetupVaultFromInviteParams): Promise<boolean> => {
        setIsLoading(true);
        try {
            const dek = await unwrapDEKWithInviteCode(
                wrappedDEK.encryptedDEK,
                wrappedDEK.dekSalt,
                wrappedDEK.dekIV,
                inviteCode,
            );

            const { encryptedDEK, dekSalt, dekIV } = await rewrapDEKWithPassword(dek, password);

            const { error } = await (supabase as any)
                .from('user_vault_keys')
                .upsert({
                    user_id: userId,
                    household_id: householdId,
                    encrypted_dek: encryptedDEK,
                    dek_salt: dekSalt,
                    dek_iv: dekIV,
                    encryption_version: 1,
                });

            if (error) {
                console.error('Failed to store invite-derived vault key:', error);
                return false;
            }

            dekRef.current = dek;
            dekUserIdRef.current = userId;
            setIsUnlocked(true);
            resetInactivityTimer();
            return true;
        } catch (error) {
            console.error('Failed to set up vault from invite:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [resetInactivityTimer]);

    const changePassword = useCallback(async (
        oldPassword: string,
        newPassword: string,
        userId: string,
    ): Promise<boolean> => {
        setIsLoading(true);
        try {
            const householdId = await resolveActiveHouseholdId(userId);
            if (!householdId) {
                console.error('No household membership; cannot change password');
                return false;
            }

            const { data: vault, error: fetchError } = await (supabase as any)
                .from('user_vault_keys')
                .select('encrypted_dek, dek_salt, dek_iv')
                .eq('user_id', userId)
                .eq('household_id', householdId)
                .single();

            if (fetchError || !vault?.encrypted_dek) {
                console.error('Failed to fetch encryption keys:', fetchError);
                return false;
            }

            const dek = await unlockVault(
                oldPassword,
                vault.encrypted_dek,
                vault.dek_salt,
                vault.dek_iv,
            );

            const { encryptedDEK, dekSalt, dekIV } = await reEncryptDEK(dek, newPassword);

            const { error: updateError } = await (supabase as any)
                .from('user_vault_keys')
                .update({
                    encrypted_dek: encryptedDEK,
                    dek_salt: dekSalt,
                    dek_iv: dekIV,
                })
                .eq('user_id', userId)
                .eq('household_id', householdId);

            if (updateError) {
                console.error('Failed to update encryption keys:', updateError);
                return false;
            }

            dekRef.current = dek;
            dekUserIdRef.current = userId;
            setIsUnlocked(true);

            return true;
        } catch (error) {
            console.error('Failed to change password:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const prepareRecoveryCode = useCallback(async (): Promise<PreparedRecoverySlot | null> => {
        if (!dekRef.current) {
            console.warn('Cannot prepare recovery code: vault is locked');
            return null;
        }
        try {
            const code = await generateRecoveryCode();
            const wrapped = await wrapDEKWithRecoveryCode(dekRef.current, code);
            return { code, ...wrapped };
        } catch (err) {
            console.error('Failed to prepare recovery code:', err);
            return null;
        }
    }, []);

    const persistRecoveryCode = useCallback(async (userId: string, slot: PreparedRecoverySlot): Promise<boolean> => {
        try {
            await (supabase as any)
                .from('user_vault_recovery_slots')
                .delete()
                .eq('user_id', userId)
                .eq('slot_type', 'recovery_code');

            const { error } = await (supabase as any)
                .from('user_vault_recovery_slots')
                .insert({
                    user_id: userId,
                    slot_type: 'recovery_code',
                    encrypted_dek: slot.encryptedDEK,
                    salt: slot.salt,
                    iv: slot.iv,
                    label: `Recovery code created ${new Date().toLocaleDateString()}`,
                });
            if (error) {
                console.error('Failed to store recovery slot:', error);
                return false;
            }
            return true;
        } catch (err) {
            console.error('Failed to persist recovery code:', err);
            return false;
        }
    }, []);

    const wrapDEKForInvite = useCallback(async (inviteCode: string) => {
        if (!dekRef.current) {
            console.warn('Cannot wrap DEK for invite: vault is locked');
            return null;
        }
        try {
            return await wrapDEKWithInviteCode(dekRef.current, inviteCode);
        } catch (err) {
            console.error('Failed to wrap DEK with invite code:', err);
            return null;
        }
    }, []);

    const hasRecoveryCode = useCallback(async (userId: string): Promise<boolean> => {
        const { data, error } = await (supabase as any)
            .from('user_vault_recovery_slots')
            .select('id')
            .eq('user_id', userId)
            .eq('slot_type', 'recovery_code')
            .maybeSingle();
        if (error) {
            console.error('Failed to check recovery slot:', error);
            return false;
        }
        return !!data;
    }, []);

    const value: EncryptionContextValue = {
        isUnlocked,
        isLoading,
        encrypt,
        decrypt,
        initializeEncryption,
        unlockWithPassword,
        setupVaultFromInvite,
        lockVault,
        changePassword,
        resetInactivityTimer,
        prepareRecoveryCode,
        persistRecoveryCode,
        hasRecoveryCode,
        wrapDEKForInvite,
        pendingExitHouseholdId,
        decryptFromPendingExit,
        clearPendingExitDEK,
        markPendingExit,
        recoveryCodeDialogOpen,
        setRecoveryCodeDialogOpen,
    };

    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            (window as any).disableVaultAutoLock = () => {
                autoLockDisabledRef.current = true;
                if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
                if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
                setShowLockWarning(false);
            };

            (window as any).enableVaultAutoLock = () => {
                autoLockDisabledRef.current = false;
                resetInactivityTimer();
            };
        }
    }, [resetInactivityTimer]);

    return (
        <EncryptionContext.Provider value={value}>
            {children}
            {showLockWarning && (
                <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50">
                    <div className="bg-bg border border-line rounded-lg p-6 max-w-md mx-4 shadow-xl">
                        <h4 className="mb-2">
                            Session Timeout Warning
                        </h4>
                        <p className="text-muted mb-4">
                            Your vault will lock in {secondsUntilLock} second{secondsUntilLock === 1 ? "" : "s"} due to inactivity.
                        </p>
                        <button
                            onClick={resetInactivityTimer}
                            className="w-full bg-accent text-accent-ink py-2 px-4 rounded-md hover:bg-accent/90 transition-colors"
                        >
                            Stay Active
                        </button>
                    </div>
                </div>
            )}
        </EncryptionContext.Provider>
    );
}

export function useEncryption(): EncryptionContextValue {
    const context = useContext(EncryptionContext);
    if (!context) {
        throw new Error('useEncryption must be used within an EncryptionProvider');
    }
    return context;
}
