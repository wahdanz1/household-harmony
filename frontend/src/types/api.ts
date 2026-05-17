// API Types for Backend Integration

// Tax Calculations
export interface IncomeForTax {
    gross_monthly: number;
    tax_type: 'no_tax' | 'standard_30' | 'progressive' | 'csn_variable';
    custom_rate?: number;
    tax_deducted?: number;
}

export interface MonthlyTaxResult {
    gross_income: number;
    tax_amount: number;
    net_income: number;
    effective_rate: number;
    breakdown: {
        income_source: string;
        gross: number;
        tax: number;
        net: number;
    }[];
}

export interface TaxPrognosisResult {
    expected_annual_tax: number;
    actual_tax_deducted: number;
    prognosis: number;
    status: 'owing' | 'refund';
    message: string;
    total_gross_annual: number;
}

// API Error
export interface ApiError {
    message: string;
    code?: string;
    details?: string;
}
