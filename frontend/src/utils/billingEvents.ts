import { addMonths, isWithinInterval } from "date-fns";
import { getFinancialMonthRange } from "./dateUtils";

export interface BillingScheduleSource {
    billing_cycle: string;
    billing_month?: number | null;
    billing_day?: number | null;
    is_active: boolean;
}

/**
 * Compute the calendar Date of the billing event closest to (and at or after)
 * a reference date, given the source's schedule. Returns null when the
 * source has no billing schedule (e.g. monthly without billing_month/day,
 * non-monthly without billing_month).
 *
 * billing_day defaults to 15 when NULL — gives FM-placement a reasonable
 * "mid-month" anchor so month-only schedules still drive warnings.
 */
export function nextBillingEvent(
    source: BillingScheduleSource,
    reference: Date,
): Date | null {
    if (!source.is_active) return null;
    if (source.billing_cycle === "monthly") {
        // Monthly = every month. Treat the reference's month as the "next" event.
        // (Frontend callers usually translate to "is this in current FM" via FM math.)
        const day = source.billing_day ?? 15;
        return clampedDate(reference.getFullYear(), reference.getMonth(), day);
    }
    if (source.billing_month == null) return null;

    const monthsStep =
        source.billing_cycle === "yearly" ? 12
        : source.billing_cycle === "semi_annually" ? 6
        : source.billing_cycle === "quarterly" ? 3
        : 0;
    if (monthsStep === 0) return null;

    const day = source.billing_day ?? 15;
    let year = reference.getFullYear();
    let monthIdx = source.billing_month - 1;

    let candidate = clampedDate(year, monthIdx, day);
    while (candidate < reference) {
        monthIdx += monthsStep;
        while (monthIdx > 11) {
            monthIdx -= 12;
            year += 1;
        }
        candidate = clampedDate(year, monthIdx, day);
    }
    return candidate;
}

/**
 * Yield the billing events for a source within a calendar-date window.
 * Walks forward by billing-cycle until past `windowEnd`.
 */
export function billingEventsInWindow(
    source: BillingScheduleSource,
    windowStart: Date,
    windowEnd: Date,
): Date[] {
    if (!source.is_active) return [];
    const events: Date[] = [];

    if (source.billing_cycle === "monthly") {
        const day = source.billing_day ?? 15;
        let cursor = clampedDate(windowStart.getFullYear(), windowStart.getMonth(), day);
        while (cursor < windowStart) cursor = addMonths(cursor, 1);
        while (cursor <= windowEnd) {
            events.push(cursor);
            cursor = addMonths(cursor, 1);
        }
        return events;
    }

    if (source.billing_month == null) return [];
    const monthsStep =
        source.billing_cycle === "yearly" ? 12
        : source.billing_cycle === "semi_annually" ? 6
        : source.billing_cycle === "quarterly" ? 3
        : 0;
    if (monthsStep === 0) return [];

    const day = source.billing_day ?? 15;
    let year = windowStart.getFullYear();
    let monthIdx = source.billing_month - 1;
    let candidate = clampedDate(year, monthIdx, day);

    // Wind back to first candidate at or before windowStart.
    while (candidate > windowStart) {
        monthIdx -= monthsStep;
        while (monthIdx < 0) {
            monthIdx += 12;
            year -= 1;
        }
        candidate = clampedDate(year, monthIdx, day);
    }
    while (candidate < windowStart) {
        monthIdx += monthsStep;
        while (monthIdx > 11) {
            monthIdx -= 12;
            year += 1;
        }
        candidate = clampedDate(year, monthIdx, day);
    }
    while (candidate <= windowEnd) {
        events.push(candidate);
        monthIdx += monthsStep;
        while (monthIdx > 11) {
            monthIdx -= 12;
            year += 1;
        }
        candidate = clampedDate(year, monthIdx, day);
    }
    return events;
}

/**
 * Does this source have a billing event inside the given FM?
 */
export function billsInFinancialMonth(
    source: BillingScheduleSource,
    fmReference: string | Date,
    fms: number,
): boolean {
    if (!source.is_active) return false;
    const { start, end } = getFinancialMonthRange(fmReference, fms);
    if (source.billing_cycle === "monthly") return true;
    if (source.billing_month == null) return false;
    return billingEventsInWindow(source, start, end).length > 0;
}

/** make_date with clamping for Feb 31 etc. */
function clampedDate(year: number, monthIdx: number, day: number): Date {
    const lastDayOfMonth = new Date(year, monthIdx + 1, 0).getDate();
    const clamped = Math.min(Math.max(day, 1), lastDayOfMonth);
    return new Date(year, monthIdx, clamped);
}

/**
 * Convenience for callers that want both this-FM and next-FM signals for
 * a list of sources. Returns sets of source ids.
 */
export function classifySourcesByFM<T extends BillingScheduleSource & { id: string }>(
    sources: T[],
    fmReference: string | Date,
    fms: number,
): { thisFm: Set<string>; nextFm: Set<string> } {
    const { start: thisStart, end: thisEnd } = getFinancialMonthRange(fmReference, fms);
    const { start: nextStart, end: nextEnd } = getFinancialMonthRange(
        addMonths(thisStart, 1),
        fms,
    );

    const thisFm = new Set<string>();
    const nextFm = new Set<string>();
    for (const source of sources) {
        if (!source.is_active) continue;
        if (source.billing_cycle === "monthly") {
            thisFm.add(source.id);
            continue;
        }
        if (source.billing_month == null) continue;
        const events = billingEventsInWindow(source, thisStart, nextEnd);
        for (const evt of events) {
            if (isWithinInterval(evt, { start: thisStart, end: thisEnd })) thisFm.add(source.id);
            else if (isWithinInterval(evt, { start: nextStart, end: nextEnd })) nextFm.add(source.id);
        }
    }
    return { thisFm, nextFm };
}
