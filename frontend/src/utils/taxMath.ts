export type TaxType = "no_tax" | "standard_30" | "progressive" | "csn_variable";

const BRACKET_LOW_ANNUAL = 523200;
const RATE_LOW = 0.32;
const RATE_HIGH = 0.52;

export function computeFromNet(
    netMonthly: number,
    taxType: TaxType | null | undefined,
    customRatePct?: number | null,
): { gross: number; tax: number; effectiveRate: number } {
    if (!netMonthly || netMonthly <= 0 || !taxType || taxType === "no_tax") {
        return { gross: netMonthly, tax: 0, effectiveRate: 0 };
    }

    if (taxType === "standard_30") {
        const gross = netMonthly / (1 - 0.3);
        return { gross, tax: gross - netMonthly, effectiveRate: 0.3 };
    }

    if (taxType === "csn_variable") {
        const rate = (customRatePct ?? 0) / 100;
        if (rate <= 0 || rate >= 1) return { gross: netMonthly, tax: 0, effectiveRate: rate };
        const gross = netMonthly / (1 - rate);
        return { gross, tax: gross - netMonthly, effectiveRate: rate };
    }

    if (taxType === "progressive") {
        const annualNet = netMonthly * 12;
        const lowGross = BRACKET_LOW_ANNUAL;
        const lowNet = lowGross * (1 - RATE_LOW);
        const annualGross = annualNet <= lowNet
            ? annualNet / (1 - RATE_LOW)
            : lowGross + (annualNet - lowNet) / (1 - RATE_HIGH);
        const gross = annualGross / 12;
        const tax = gross - netMonthly;
        return { gross, tax, effectiveRate: tax / gross };
    }

    return { gross: netMonthly, tax: 0, effectiveRate: 0 };
}

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
    no_tax: "No tax",
    standard_30: "30%",
    progressive: "Progressive (32–52%)",
    csn_variable: "Custom %",
};
