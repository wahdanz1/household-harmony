/**
 * Format a category string by replacing underscores with spaces
 * and capitalizing each word
 */
export const formatCategory = (category: string): string => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

/**
 * Format a number as currency with the specified currency code
 */
export const formatCurrency = (amount: number, currency: string): string => {
    return `${amount.toFixed(0)} ${currency}`;
};

/**
 * Format a number with thousands separators
 */
export const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('en-US').format(value);
};
