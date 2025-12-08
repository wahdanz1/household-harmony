import { format, addMonths, subMonths, startOfMonth, endOfMonth, setDate, isBefore, isAfter } from "date-fns";

/**
 * Calculate the current financial month based on custom start day
 * Returns a string in format "yyyy-MM-dd" representing the month period
 * @param financialMonthStart - Day of month when financial month starts (default: 25)
 */
export function getCurrentFinancialMonth(financialMonthStart: number = 25): string {
    const today = new Date();
    const { start } = getFinancialMonthRange(today, financialMonthStart);
    return format(start, "yyyy-MM-dd");
}

/**
 * Get start and end dates for a financial month period
 * @param referenceDate - Any date within the desired financial month
 * @param customStartDay - Day of month when financial month starts (default: 25)
 * @returns Object with start and end dates
 */
export function getFinancialMonthRange(
    referenceDate: Date | string,
    customStartDay: number = 25
): { start: Date; end: Date } {
    const date = typeof referenceDate === "string" ? new Date(referenceDate) : referenceDate;

    // Get the start day of current calendar month
    const currentMonthStart = setDate(date, customStartDay);

    // If today is before the custom start day, we're in the previous financial month
    const financialMonthStart = isBefore(date, currentMonthStart)
        ? setDate(subMonths(date, 1), customStartDay)
        : currentMonthStart;

    // End date is one day before next month's start
    const financialMonthEnd = setDate(addMonths(financialMonthStart, 1), customStartDay - 1);

    return {
        start: financialMonthStart,
        end: financialMonthEnd,
    };
}

/**
 * Format financial month for display as "MMM DD - MMM DD" (e.g., "Nov 25 - Dec 24")
 * @param monthString - Month string in "yyyy-MM-dd" format
 * @param customStartDay - Day of month when financial month starts (default: 25)
 */
export function formatFinancialMonth(
    monthString: string,
    customStartDay: number = 25
): string {
    const { start, end } = getFinancialMonthRange(monthString, customStartDay);

    // Format as "Nov 25 - Dec 24"
    return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
}

/**
 * Get the previous financial month
 */
export function getPreviousFinancialMonth(currentMonth: string, customStartDay: number = 25): string {
    const { start } = getFinancialMonthRange(currentMonth, customStartDay);
    const previousStart = subMonths(start, 1);
    return format(previousStart, "yyyy-MM-dd");
}

/**
 * Get the next financial month
 */
export function getNextFinancialMonth(currentMonth: string, customStartDay: number = 25): string {
    const { start } = getFinancialMonthRange(currentMonth, customStartDay);
    const nextStart = addMonths(start, 1);
    return format(nextStart, "yyyy-MM-dd");
}
