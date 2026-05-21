/**
 * useEncryptedFields Hook
 * 
 * Provides helper functions for encrypting/decrypting sensitive data fields.
 * Used by data pages (Income, Expenses, etc.) for transparent encryption.
 */

import { useCallback } from 'react';
import { useEncryption } from '@/contexts/EncryptionContext';

interface EncryptedRecord {
    is_encrypted?: boolean;
    [key: string]: any;
}

interface EncryptionFieldConfig {
    /** Original field name (e.g., 'name', 'amount') */
    original: string;
    /** Encrypted field name (e.g., 'encrypted_name', 'encrypted_amount') */
    encrypted: string;
}

/**
 * Hook for transparent encryption/decryption of data fields.
 * 
 * Usage:
 * const { encryptRecord, decryptRecord, decryptRecords } = useEncryptedFields([
 *   { original: 'name', encrypted: 'encrypted_name' },
 *   { original: 'budget', encrypted: 'encrypted_budget' },
 * ]);
 */
export function useEncryptedFields(fieldConfigs: EncryptionFieldConfig[]) {
    const { encrypt, decrypt, isUnlocked } = useEncryption();

    /**
     * Encrypt a record before saving to database.
     * - Encrypts specified fields and stores in encrypted_ columns
     * - Sets original plaintext fields to null (prevents plaintext in DB)
     * - Sets is_encrypted = true
     */
    const encryptRecord = useCallback(async <T extends Record<string, any>>(
        record: T
    ): Promise<T & { is_encrypted: boolean }> => {
        if (!isUnlocked) {
            console.warn('Cannot encrypt: vault is locked');
            return { ...record, is_encrypted: false };
        }

        const encryptedRecord = { ...record } as T & { is_encrypted: boolean };

        for (const config of fieldConfigs) {
            if (!(config.original in encryptedRecord)) continue;
            const value = (encryptedRecord as any)[config.original];
            // Strip plaintext so it never reaches the DB.
            delete (encryptedRecord as any)[config.original];
            if (value !== undefined && value !== null && value !== '') {
                const encryptedValue = await encrypt(String(value));
                if (encryptedValue) {
                    (encryptedRecord as any)[config.encrypted] = encryptedValue;
                }
            } else {
                // Caller explicitly cleared it — null the encrypted column too.
                (encryptedRecord as any)[config.encrypted] = null;
            }
        }

        encryptedRecord.is_encrypted = true;
        return encryptedRecord;
    }, [encrypt, isUnlocked, fieldConfigs]);

    /**
     * Decrypt a single record after reading from database.
     * - If is_encrypted is true, decrypts encrypted_ columns to original columns
     * - If is_encrypted is false/undefined, returns record as-is (legacy unencrypted data)
     */
    const decryptRecord = useCallback(async <T extends EncryptedRecord>(
        record: T
    ): Promise<T> => {
        // If not encrypted or vault is locked, return as-is
        if (!record.is_encrypted || !isUnlocked) {
            return record;
        }

        const decryptedRecord = { ...record };

        for (const config of fieldConfigs) {
            const encryptedValue = record[config.encrypted];
            if (encryptedValue) {
                const decryptedValue = await decrypt(encryptedValue);
                if (decryptedValue !== null) {
                    // Parse numbers if the original field was numeric
                    const originalValue = record[config.original];
                    if (typeof originalValue === 'number' || !isNaN(Number(decryptedValue))) {
                        (decryptedRecord as any)[config.original] = parseFloat(decryptedValue);
                    } else {
                        (decryptedRecord as any)[config.original] = decryptedValue;
                    }
                }
            }
        }

        return decryptedRecord;
    }, [decrypt, isUnlocked, fieldConfigs]);

    /**
     * Decrypt an array of records.
     */
    const decryptRecords = useCallback(async <T extends EncryptedRecord>(
        records: T[]
    ): Promise<T[]> => {
        if (!isUnlocked) {
            // Return records as-is if vault is locked
            return records;
        }

        return Promise.all(records.map(record => decryptRecord(record)));
    }, [decryptRecord, isUnlocked]);

    /**
     * Check if encryption is available (vault unlocked).
     */
    const canEncrypt = isUnlocked;

    return {
        encryptRecord,
        decryptRecord,
        decryptRecords,
        canEncrypt,
        isUnlocked,
    };
}

// Pre-configured hooks for specific data types
export const incomeSourceFields: EncryptionFieldConfig[] = [
    { original: 'name', encrypted: 'encrypted_name' },
    { original: 'provider', encrypted: 'encrypted_provider' },
    { original: 'budget', encrypted: 'encrypted_budget' },
];

export const monthlyIncomeFields: EncryptionFieldConfig[] = [
    { original: 'budget_snapshot', encrypted: 'encrypted_budget_snapshot' },
    { original: 'previous_budget_snapshot', encrypted: 'encrypted_previous_budget_snapshot' },
    { original: 'actual_amount', encrypted: 'encrypted_actual_amount' },
];

export const expenseFields: EncryptionFieldConfig[] = [
    { original: 'name', encrypted: 'encrypted_name' },
    { original: 'budget', encrypted: 'encrypted_budget' },
];

export const monthlyExpenseFields: EncryptionFieldConfig[] = [
    { original: 'budget_snapshot', encrypted: 'encrypted_budget_snapshot' },
    { original: 'previous_budget_snapshot', encrypted: 'encrypted_previous_budget_snapshot' },
    { original: 'actual_amount', encrypted: 'encrypted_actual_amount' },
];

export const subscriptionFields: EncryptionFieldConfig[] = [
    { original: 'name', encrypted: 'encrypted_name' },
    { original: 'service', encrypted: 'encrypted_service' },
    { original: 'budget', encrypted: 'encrypted_budget' },
];

export const monthlySubscriptionFields: EncryptionFieldConfig[] = [
    { original: 'budget_snapshot', encrypted: 'encrypted_budget_snapshot' },
    { original: 'previous_budget_snapshot', encrypted: 'encrypted_previous_budget_snapshot' },
    { original: 'actual_amount', encrypted: 'encrypted_actual_amount' },
];

export const insuranceFields: EncryptionFieldConfig[] = [
    { original: 'name', encrypted: 'encrypted_name' },
    { original: 'budget', encrypted: 'encrypted_budget' },
    { original: 'provider', encrypted: 'encrypted_provider' },
];

export const monthlyInsuranceFields: EncryptionFieldConfig[] = [
    { original: 'budget_snapshot', encrypted: 'encrypted_budget_snapshot' },
    { original: 'previous_budget_snapshot', encrypted: 'encrypted_previous_budget_snapshot' },
    { original: 'actual_amount', encrypted: 'encrypted_actual_amount' },
];

export const creditCardExpenseFields: EncryptionFieldConfig[] = [
    { original: 'description', encrypted: 'encrypted_description' },
    { original: 'amount', encrypted: 'encrypted_amount' },
];

export const creditCardFields: EncryptionFieldConfig[] = [
    { original: 'name', encrypted: 'encrypted_name' },
    { original: 'monthly_limit', encrypted: 'encrypted_monthly_limit' },
];

export const sharedExpenseFields: EncryptionFieldConfig[] = [
    { original: 'description', encrypted: 'encrypted_description' },
    { original: 'amount', encrypted: 'encrypted_amount' },
];

export const temporaryExpenseFields: EncryptionFieldConfig[] = [
    { original: 'description', encrypted: 'encrypted_description' },
    { original: 'amount', encrypted: 'encrypted_amount' },
];
