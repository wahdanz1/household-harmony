// Smart Defaults — frontend-only suggestion computation.
//
// History: the original implementation called a backend endpoint
// (/api/defaults/income/{id}) that computed averages from plaintext columns.
// That broke when the encryption migration removed those columns. Now defaults
// are computed client-side from already-decrypted records, since only the
// client has the keys.
//
// The carry-forward layer (utils/carryForward.fetchMostRecentByKey) handles
// the "pull last month's value into the new month" case. This module adds
// the smarter cases — averages and confidence indicators.

export type SmartDefaultSource = "last_month" | "average_3_months" | null;

export interface SmartDefault {
    source: SmartDefaultSource;
    value: number;
    confidence: "high" | "medium" | "low";
    /** How many historical records contributed to this suggestion. */
    basedOn: number;
}

/**
 * Decide the best default value from up to 3 most-recent historical records.
 *
 * Rules:
 *  - 0 records → no suggestion
 *  - 1 record  → carry forward last month (medium confidence)
 *  - 2-3 records → if last month is within 5% of the 3-month avg the value is
 *                  stable, surface it as `last_month` with high confidence.
 *                  Otherwise prefer the average.
 *
 * Records must be sorted month-desc (most recent first).
 */
export const computeSmartDefault = (
    records: { amount: string | number }[],
): SmartDefault => {
    if (records.length === 0) {
        return { source: null, value: 0, confidence: "low", basedOn: 0 };
    }

    const amounts = records.map(r => parseFloat(r.amount.toString()) || 0);
    const lastMonth = amounts[0];

    if (records.length === 1) {
        return { source: "last_month", value: lastMonth, confidence: "medium", basedOn: 1 };
    }

    const window = amounts.slice(0, 3);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;

    if (avg > 0 && Math.abs(lastMonth - avg) / avg < 0.05) {
        return { source: "last_month", value: lastMonth, confidence: "high", basedOn: window.length };
    }

    return { source: "average_3_months", value: avg, confidence: "medium", basedOn: window.length };
};
