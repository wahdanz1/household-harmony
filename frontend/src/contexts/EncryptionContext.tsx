import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
    encrypt as encryptValue,
    decrypt as decryptValue,
    createUserEncryptionKeys,
    unlockVault,
    reEncryptDEK,
} from '@/services/encryption';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface EncryptionContextValue {
    /** Whether the vault is unlocked (DEK is available) */
    isUnlocked: boolean;

    /** Whether encryption is being initialized */
    isLoading: boolean;

    /** Encrypt a string value. Returns null if vault is locked. */
    encrypt: (plaintext: string) => Promise<string | null>;

    /** Decrypt a ciphertext. Returns null if vault is locked or decryption fails. */
    decrypt: (ciphertext: string) => Promise<string | null>;

    /** 
     * Initialize encryption for a new user (during registration).
     * Generates DEK, encrypts with password, stores in profile.
     */
    initializeEncryption: (password: string, userId: string) => Promise<boolean>;

    /**
     * Unlock the vault using password (during login).
     * Fetches encrypted DEK from profile, decrypts it.
     */
    unlockWithPassword: (password: string, userId: string) => Promise<boolean>;

    /**
     * Lock the vault (clear DEK from memory).
     */
    lockVault: () => void;

    /**
     * Change password - re-encrypt DEK with new password.
     */
    changePassword: (oldPassword: string, newPassword: string, userId: string) => Promise<boolean>;

    /**
     * Reset inactivity timer (called on user activity).
     */
    resetInactivityTimer: () => void;
}

const EncryptionContext = createContext<EncryptionContextValue | null>(null);

// Inactivity timeout in milliseconds (30 minutes)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
// Warning before lock (60 seconds)
const LOCK_WARNING_TIME = 60 * 1000;

interface EncryptionProviderProps {
    children: React.ReactNode;
}

export function EncryptionProvider({ children }: EncryptionProviderProps) {
    // DEK stored only in memory - never persisted!
    const dekRef = useRef<CryptoKey | null>(null);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Inactivity tracking
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
    const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [showLockWarning, setShowLockWarning] = useState(false);
    const autoLockDisabledRef = useRef(false);

    // Clear timers on unmount
    useEffect(() => {
        return () => {
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        };
    }, []);

    // Auto-unlock vault for demo mode on app load
    useEffect(() => {
        const autoUnlockDemo = async () => {
            // Import here to avoid circular dependency
            const { isDemoMode } = await import('@/utils/demoMode');

            // Only auto-unlock if: demo mode + vault locked + password available
            const demoPassword = sessionStorage.getItem('demo_password');
            if (!isDemoMode() || isUnlocked || !demoPassword) {
                return;
            }

            // Need user ID from auth
            const authData = await supabase.auth.getUser();
            if (!authData.data.user) return;

            console.log('Auto-unlocking demo vault...');
            // Import the unlock function from encryption service
            const { unlockVault: unlockFn } = await import('@/services/encryption');

            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('encrypted_dek, dek_salt, dek_iv')
                    .eq('id', authData.data.user.id)
                    .single();

                if (profile?.encrypted_dek) {
                    const dek = await unlockFn(demoPassword, profile.encrypted_dek, profile.dek_salt, profile.dek_iv);
                    dekRef.current = dek;
                    setIsUnlocked(true);
                    console.log('Demo vault auto-unlocked successfully');
                }
            } catch (error) {
                console.warn('Demo vault auto-unlock failed:', error);
            }
        };

        autoUnlockDemo();
    }, [isUnlocked]); // Re-run if unlock status changes

    // Reset inactivity timer
    const resetInactivityTimer = useCallback(() => {
        setShowLockWarning(false);

        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);

        if (!isUnlocked || autoLockDisabledRef.current) return;

        // Set warning timer (fires before lock) - show toast
        warningTimerRef.current = setTimeout(() => {
            setShowLockWarning(true);
            toast({
                title: 'Vault Auto-Lock Warning',
                description: 'You have been inactive. The vault will lock in 1 minute. Interact with the app to stay active.',
                duration: 55000, // Show for almost the full minute
            });
        }, INACTIVITY_TIMEOUT - LOCK_WARNING_TIME);

        // Set lock timer
        inactivityTimerRef.current = setTimeout(() => {
            if (!autoLockDisabledRef.current) {
                lockVault();
                toast({
                    title: 'Vault Locked',
                    description: 'Your vault has been locked due to inactivity. Please unlock to continue.',
                    variant: 'destructive',
                });
            }
        }, INACTIVITY_TIMEOUT);
    }, [isUnlocked]);

    // Lock vault - clear DEK from memory
    const lockVault = useCallback(() => {
        dekRef.current = null;
        setIsUnlocked(false);
        setShowLockWarning(false);
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    }, []);

    // Encrypt a value
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

    // Decrypt a value
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

    // Initialize encryption for new user
    const initializeEncryption = useCallback(async (password: string, userId: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const { encryptedDEK, dekSalt, dekIV, dek } = await createUserEncryptionKeys(password);

            // Store encrypted DEK in user's profile
            const { error } = await supabase
                .from('profiles')
                .update({
                    encrypted_dek: encryptedDEK,
                    dek_salt: dekSalt,
                    dek_iv: dekIV,
                    encryption_version: 1,
                })
                .eq('id', userId);

            if (error) {
                console.error('Failed to store encryption keys:', error);
                return false;
            }

            // Store DEK in memory
            dekRef.current = dek;
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

    // Unlock vault with password
    const unlockWithPassword = useCallback(async (password: string, userId: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            // Fetch encrypted DEK from profile
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('encrypted_dek, dek_salt, dek_iv')
                .eq('id', userId)
                .single();

            if (error || !profile) {
                console.error('Failed to fetch encryption keys:', error);
                return false;
            }

            // If user doesn't have encryption set up yet, initialize it
            if (!profile.encrypted_dek || !profile.dek_salt || !profile.dek_iv) {
                // User doesn't have encryption set up yet, initialize it
                return await initializeEncryption(password, userId);
            }

            // Decrypt DEK
            const dek = await unlockVault(
                password,
                profile.encrypted_dek,
                profile.dek_salt,
                profile.dek_iv
            );

            // Store DEK in memory
            dekRef.current = dek;
            setIsUnlocked(true);
            resetInactivityTimer();

            return true;
        } catch (error) {
            console.error('Failed to unlock vault:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [initializeEncryption, resetInactivityTimer]);

    // Change password
    const changePassword = useCallback(async (
        oldPassword: string,
        newPassword: string,
        userId: string
    ): Promise<boolean> => {
        setIsLoading(true);
        try {
            // First verify old password by trying to unlock
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('encrypted_dek, dek_salt, dek_iv')
                .eq('id', userId)
                .single();

            if (fetchError || !profile?.encrypted_dek) {
                console.error('Failed to fetch encryption keys:', fetchError);
                return false;
            }

            // Decrypt DEK with old password
            const dek = await unlockVault(
                oldPassword,
                profile.encrypted_dek,
                profile.dek_salt,
                profile.dek_iv
            );

            // Re-encrypt DEK with new password
            const { encryptedDEK, dekSalt, dekIV } = await reEncryptDEK(dek, newPassword);

            // Update profile with new encrypted DEK
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    encrypted_dek: encryptedDEK,
                    dek_salt: dekSalt,
                    dek_iv: dekIV,
                })
                .eq('id', userId);

            if (updateError) {
                console.error('Failed to update encryption keys:', updateError);
                return false;
            }

            // Update DEK in memory
            dekRef.current = dek;
            setIsUnlocked(true);

            return true;
        } catch (error) {
            console.error('Failed to change password:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const value: EncryptionContextValue = {
        isUnlocked,
        isLoading,
        encrypt,
        decrypt,
        initializeEncryption,
        unlockWithPassword,
        lockVault,
        changePassword,
        resetInactivityTimer,
    };

    // --- Developer Mode: Disable Auto-Lock ---
    // Expose functions to window for developers to control auto-lock
    // Usage in console: window.disableVaultAutoLock() / window.enableVaultAutoLock()
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
    // -----------------------------------------

    return (
        <EncryptionContext.Provider value={value}>
            {children}
            {/* Lock Warning Modal */}
            {showLockWarning && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-background border border-border rounded-lg p-6 max-w-md mx-4 shadow-xl">
                        <h4 className="mb-2">
                            Session Timeout Warning
                        </h4>
                        <p className="text-muted-foreground mb-4">
                            Your vault will lock in 60 seconds due to inactivity.
                        </p>
                        <button
                            onClick={resetInactivityTimer}
                            className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition-colors"
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
