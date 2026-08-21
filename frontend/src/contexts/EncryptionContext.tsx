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
    unlockVaultWithKEK,
    wrapDEKWithKEK,
} from '@/services/encryption';
import { loadCoParentSpaceKeys, rewrapCoParentSpaceKeys } from '@/services/coparentSpaces';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface EncryptionContextValue {
    isUnlocked: boolean;
    isLoading: boolean;
    encrypt: (plaintext: string) => Promise<string | null>;
    decrypt: (ciphertext: string) => Promise<string | null>;

    /** Encrypt with the key held for `scope`. Null when no such key is loaded. */
    encryptFor: (scope: string, plaintext: string) => Promise<string | null>;
    /** Decrypt with the key held for `scope`. Null when no such key is loaded. */
    decryptFor: (scope: string, ciphertext: string) => Promise<string | null>;
    /** Whether a key is currently held for `scope`. */
    hasScopeKey: (scope: string) => boolean;
    /** Hold a key for `scope` until the vault locks. */
    loadScopeKey: (scope: string, key: CryptoKey) => void;
    /** Drop the key held for `scope`. */
    dropScopeKey: (scope: string) => void;

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
    /** Wrap a co-parenting space's key with an invite code, for handing it to a new member. */
    wrapSpaceDEKForInvite: (spaceId: string, inviteCode: string) => Promise<{ encryptedDEK: string; salt: string; iv: string } | null>;
    /**
     * Wrap a freshly generated key so only this user can reopen it, using the
     * KEK cached at unlock. Null when the vault is locked. Removes the need to
     * re-ask for a password that has already been proven this session.
     */
    wrapKeyForSelf: (key: CryptoKey) => Promise<{ encryptedDEK: string; dekSalt: string; dekIV: string } | null>;

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

/** The active household's DEK. Every existing encrypt/decrypt call uses this. */
export const HOUSEHOLD_SCOPE = 'household';
/** DEK of a household the user has been soft-removed from, for the exit dialog. */
export const PENDING_EXIT_SCOPE = 'pending-exit';
/** Key scope for a co-parenting space shared with someone outside the household. */
export const spaceScope = (spaceId: string) => `space:${spaceId}`;

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
    // Every key this session holds, keyed by scope. The active household's DEK
    // lives under HOUSEHOLD_SCOPE; a co-parenting space adds its own alongside
    // it. Nothing in here may outlive lockVault().
    const keyringRef = useRef<Map<string, CryptoKey>>(new Map());
    // The user the in-memory keys belong to. Lets the auth-change listener
    // distinguish "stale keys from a different user" (lock) from "keys just set
    // up for the user we're transitioning into" (don't lock).
    const dekUserIdRef = useRef<string | null>(null);
    // The KEK the vault was opened with, plus the salt it came from. Lets new
    // keys be wrapped for this user without re-prompting. Cleared with the
    // keyring — it is exactly as sensitive as the DEK it unwraps.
    const kekRef = useRef<CryptoKey | null>(null);
    const kekSaltRef = useRef<string | null>(null);
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
                keyringRef.current.clear();
                kekRef.current = null;
                kekSaltRef.current = null;
                dekUserIdRef.current = null;
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
                    keyringRef.current.set(HOUSEHOLD_SCOPE, dek);
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
        keyringRef.current.clear();
        kekRef.current = null;
        kekSaltRef.current = null;
        dekUserIdRef.current = null;
        setPendingExitHouseholdId(null);
        setIsUnlocked(false);
        setShowLockWarning(false);
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    }, []);

    const decryptFromPendingExit = useCallback(async (ciphertext: string): Promise<string | null> => {
        const dek = keyringRef.current.get(PENDING_EXIT_SCOPE);
        if (!dek) return null;
        try {
            return await decryptValue(ciphertext, dek);
        } catch (err) {
            console.error('Failed to decrypt pending-exit ciphertext:', err);
            return null;
        }
    }, []);

    const clearPendingExitDEK = useCallback(() => {
        keyringRef.current.delete(PENDING_EXIT_SCOPE);
        setPendingExitHouseholdId(null);
    }, []);

    const markPendingExit = useCallback((householdId: string, dek: CryptoKey) => {
        keyringRef.current.set(PENDING_EXIT_SCOPE, dek);
        setPendingExitHouseholdId(householdId);
    }, []);

    const hasScopeKey = useCallback((scope: string): boolean => keyringRef.current.has(scope), []);

    const loadScopeKey = useCallback((scope: string, key: CryptoKey) => {
        keyringRef.current.set(scope, key);
    }, []);

    const dropScopeKey = useCallback((scope: string) => {
        keyringRef.current.delete(scope);
    }, []);

    const encryptFor = useCallback(async (scope: string, plaintext: string): Promise<string | null> => {
        const key = keyringRef.current.get(scope);
        if (!key) {
            console.warn(`Encryption attempted without a key for scope "${scope}"`);
            return null;
        }
        try {
            return await encryptValue(plaintext, key);
        } catch (error) {
            console.error('Encryption failed:', error);
            return null;
        }
    }, []);

    const decryptFor = useCallback(async (scope: string, ciphertext: string): Promise<string | null> => {
        const key = keyringRef.current.get(scope);
        if (!key) {
            console.warn(`Decryption attempted without a key for scope "${scope}"`);
            return null;
        }
        try {
            return await decryptValue(ciphertext, key);
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }, []);

    const encrypt = useCallback(
        (plaintext: string) => encryptFor(HOUSEHOLD_SCOPE, plaintext),
        [encryptFor],
    );

    const decrypt = useCallback(
        (ciphertext: string) => decryptFor(HOUSEHOLD_SCOPE, ciphertext),
        [decryptFor],
    );

    const initializeEncryption = useCallback(async (
        password: string,
        userId: string,
        householdId: string,
    ): Promise<boolean> => {
        setIsLoading(true);
        try {
            const { encryptedDEK, dekSalt, dekIV, dek, kek } = await createUserEncryptionKeys(password);

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

            kekRef.current = kek;
            kekSaltRef.current = dekSalt;
            keyringRef.current.set(HOUSEHOLD_SCOPE, dek);
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
                const { dek, kek } = await unlockVaultWithKEK(
                    password,
                    vault.encrypted_dek,
                    vault.dek_salt,
                    vault.dek_iv,
                );
                kekRef.current = kek;
                kekSaltRef.current = vault.dek_salt;
                keyringRef.current.set(HOUSEHOLD_SCOPE, dek);
                dekUserIdRef.current = userId;
                setIsUnlocked(true);
                resetInactivityTimer();
                unlocked = true;
            }

            if (!unlocked) return false;

            // Co-parenting space keys are wrapped under the same password, so
            // this is the one moment they can be unwrapped without asking for
            // it again. A space that fails to open must not fail the unlock.
            try {
                const spaceKeys = await loadCoParentSpaceKeys({
                    userId,
                    password,
                    kek: kekRef.current ?? undefined,
                    kekSalt: kekSaltRef.current ?? undefined,
                });
                for (const { spaceId, dek } of spaceKeys) {
                    keyringRef.current.set(spaceScope(spaceId), dek);
                }
            } catch (err) {
                console.error('Failed to load co-parenting space keys:', err);
            }

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
                        keyringRef.current.set(PENDING_EXIT_SCOPE, pendingDek);
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

            const { encryptedDEK, dekSalt, dekIV, kek } = await rewrapDEKWithPassword(dek, password);

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

            kekRef.current = kek;
            kekSaltRef.current = dekSalt;
            keyringRef.current.set(HOUSEHOLD_SCOPE, dek);
            dekUserIdRef.current = userId;
            setIsUnlocked(true);
            resetInactivityTimer();

            // Someone switching households keeps their spaces; load them here
            // too, while the password is still in hand.
            try {
                const spaceKeys = await loadCoParentSpaceKeys({
                    userId,
                    password,
                    kek: kekRef.current ?? undefined,
                    kekSalt: kekSaltRef.current ?? undefined,
                });
                for (const { spaceId, dek: spaceDek } of spaceKeys) {
                    keyringRef.current.set(spaceScope(spaceId), spaceDek);
                }
            } catch (err) {
                console.error('Failed to load co-parenting space keys:', err);
            }

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

            const { encryptedDEK, dekSalt, dekIV, kek } = await reEncryptDEK(dek, newPassword);

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

            // Space keys are wrapped under the same password, so they have to
            // move with it or every space becomes unreadable at the next
            // unlock. Runs after the household wrap lands: a space that fails
            // is recoverable by re-inviting, a lost household wrap is not.
            const { failed } = await rewrapCoParentSpaceKeys({
                userId,
                oldPassword,
                newPassword,
            });
            if (failed.length) {
                console.error('Co-parenting space keys left on the old password:', failed);
                toast({
                    title: 'Some shared spaces need re-linking',
                    description:
                        'Your password changed but a co-parenting space key did not move with it. Re-invite the co-parent to restore access.',
                    variant: 'destructive',
                });
            }

            kekRef.current = kek;
            kekSaltRef.current = dekSalt;
            keyringRef.current.set(HOUSEHOLD_SCOPE, dek);
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
        const dek = keyringRef.current.get(HOUSEHOLD_SCOPE);
        if (!dek) {
            console.warn('Cannot prepare recovery code: vault is locked');
            return null;
        }
        try {
            const code = await generateRecoveryCode();
            const wrapped = await wrapDEKWithRecoveryCode(dek, code);
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
        const dek = keyringRef.current.get(HOUSEHOLD_SCOPE);
        if (!dek) {
            console.warn('Cannot wrap DEK for invite: vault is locked');
            return null;
        }
        try {
            return await wrapDEKWithInviteCode(dek, inviteCode);
        } catch (err) {
            console.error('Failed to wrap DEK with invite code:', err);
            return null;
        }
    }, []);

    const wrapSpaceDEKForInvite = useCallback(async (spaceId: string, inviteCode: string) => {
        const dek = keyringRef.current.get(spaceScope(spaceId));
        if (!dek) {
            console.warn('Cannot wrap space DEK for invite: no key loaded for that space');
            return null;
        }
        try {
            return await wrapDEKWithInviteCode(dek, inviteCode);
        } catch (err) {
            console.error('Failed to wrap space DEK with invite code:', err);
            return null;
        }
    }, []);

    const wrapKeyForSelf = useCallback(async (key: CryptoKey) => {
        const kek = kekRef.current;
        const salt = kekSaltRef.current;
        if (!kek || !salt) {
            console.warn('Cannot wrap key: vault is locked');
            return null;
        }
        try {
            return await wrapDEKWithKEK(key, kek, salt);
        } catch (err) {
            console.error('Failed to wrap key for self:', err);
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
        encryptFor,
        decryptFor,
        hasScopeKey,
        loadScopeKey,
        dropScopeKey,
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
        wrapSpaceDEKForInvite,
        wrapKeyForSelf,
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
