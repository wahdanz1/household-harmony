/**
 * Calculate the total from a record of string amounts
 */
export const calculateTotal = (amounts: Record<string, string>): number => {
    return Object.values(amounts).reduce((sum, val) => sum + parseFloat(val || "0"), 0);
};

/**
 * Calculate the average of an array of numbers
 */
export const calculateAverage = (values: number[]): number => {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
};

/**
 * Calculate percentage of a value
 */
export const calculatePercentage = (value: number, total: number): number => {
    if (total === 0) return 0;
    return (value / total) * 100;
};

/**
 * Calculate shared amount based on percentage
 */
export const calculateSharedAmount = (amount: number, percentage: number): number => {
    return amount * (percentage / 100);
};
