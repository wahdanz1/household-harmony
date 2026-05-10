export type TaxType = "no_tax" | "standard_30" | "progressive" | "csn_variable";

const BRACKET_LOW_ANNUAL = 523200;
const RATE_LOW = 0.32;
const RATE_HIGH = 0.52;

export function computeMonthlyNet(
    grossMonthly: number,
    taxType: TaxType | null | undefined,
    customRatePct?: number | null,
): { net: number; tax: number; effectiveRate: number } {
    if (!grossMonthly || grossMonthly <= 0 || !taxType || taxType === "no_tax") {
        return { net: grossMonthly, tax: 0, effectiveRate: 0 };
    }

    if (taxType === "standard_30") {
        const tax = grossMonthly * 0.3;
        return { net: grossMonthly - tax, tax, effectiveRate: 0.3 };
    }

    if (taxType === "progressive") {
        const annualGross = grossMonthly * 12;
        const annualTax = annualGross <= BRACKET_LOW_ANNUAL
            ? annualGross * RATE_LOW
            : BRACKET_LOW_ANNUAL * RATE_LOW + (annualGross - BRACKET_LOW_ANNUAL) * RATE_HIGH;
        const tax = annualTax / 12;
        return { net: grossMonthly - tax, tax, effectiveRate: tax / grossMonthly };
    }

    if (taxType === "csn_variable") {
        const rate = (customRatePct ?? 0) / 100;
        const tax = grossMonthly * rate;
        return { net: grossMonthly - tax, tax, effectiveRate: rate };
    }

    return { net: grossMonthly, tax: 0, effectiveRate: 0 };
}

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
    no_tax: "No tax (already net)",
    standard_30: "Standard 30%",
    progressive: "Progressive (Swedish brackets)",
    csn_variable: "Custom rate",
};
