// Tax Calculation Service - Swedish tax intelligence

import { api } from './api';
import type { IncomeForTax, MonthlyTaxResult, TaxPrognosisResult } from '@/types/api';

/**
 * Calculate monthly tax for given incomes
 */
export const calculateMonthlyTax = async (
    incomes: IncomeForTax[]
): Promise<MonthlyTaxResult> => {
    const response = await api.post<MonthlyTaxResult>('/api/tax/calculate', {
        incomes,
    });
    return response;
};

/**
 * Get annual tax prognosis
 * Returns expected tax vs already deducted, with owing/refund status
 */
export const getTaxPrognosis = async (
    incomes: IncomeForTax[]
): Promise<TaxPrognosisResult> => {
    const response = await api.post<TaxPrognosisResult>('/api/tax/prognosis', {
        income_sources: incomes,
    });
    return response;
};

/**
 * Format currency for display (Swedish kronor)
 */
export const formatSEK = (amount: number): string => {
    return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

/**
 * Get status color for tax prognosis
 */
export const getTaxStatusColor = (status: 'owing' | 'refund'): string => {
    return status === 'owing' ? 'text-red-500' : 'text-green-500';
};

/**
 * Get status icon for tax prognosis
 */
export const getTaxStatusIcon = (status: 'owing' | 'refund'): string => {
    return status === 'owing' ? '⚠️' : '✅';
};
