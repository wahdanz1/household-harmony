// Smart Defaults Service - Fetches suggestions from backend

import { api } from './api';
import type { IncomeSuggestion, ExpenseSuggestion } from '@/types/api';

interface IncomeSuggestionsResponse {
    suggestions: IncomeSuggestion[];
    month: string;
    household_id: string;
}

interface ExpenseSuggestionsResponse {
    suggestions: ExpenseSuggestion[];
    month: string;
    household_id: string;
}

/**
 * Fetch income suggestions for auto-fill
 * Returns suggested amounts based on historical data
 */
export const fetchIncomeSuggestions = async (
    householdId: string
): Promise<IncomeSuggestion[]> => {
    try {
        const response = await api.get<IncomeSuggestionsResponse>(
            `/api/defaults/income/${householdId}`
        );
        return response.suggestions;
    } catch (error) {
        console.error('Failed to fetch income suggestions:', error);
        return [];
    }
};

/**
 * Fetch expense suggestions for auto-fill
 * Returns suggested amounts based on historical data
 */
export const fetchExpenseSuggestions = async (
    householdId: string
): Promise<ExpenseSuggestion[]> => {
    try {
        const response = await api.get<ExpenseSuggestionsResponse>(
            `/api/defaults/expenses/${householdId}`
        );
        return response.suggestions;
    } catch (error) {
        console.error('Failed to fetch expense suggestions:', error);
        return [];
    }
};

/**
 * Get border color class based on suggestion source
 * - green: last month's value (static)
 * - blue: 3-month average (variable)
 * - lime: user modified the suggested value
 */
export const getSuggestionBorderColor = (
    source: 'last_month' | 'average_3_months' | 'user_modified' | null
): string => {
    switch (source) {
        case 'last_month':
            return 'border-green-500 border-2';
        case 'average_3_months':
            return 'border-blue-500 border-2';
        case 'user_modified':
            return 'border-lime-500 border-2';
        default:
            return '';
    }
};
