import { Briefcase, TrendingUp, HandCoins, PiggyBank, Gift, Sparkles, LucideIcon } from "lucide-react";

export interface IncomeCategory {
    id: string;
    label: string;
    icon: LucideIcon;
    hue?: number;
}

export const INCOME_CATEGORIES: IncomeCategory[] = [
    { id: 'salary', label: 'Salary', icon: Briefcase, hue: 60 },
    { id: 'business_income', label: 'Business', icon: TrendingUp, hue: 60 },
    { id: 'government_benefits', label: 'Government Benefits', icon: HandCoins, hue: 100 },
    { id: 'investment_income', label: 'Investments', icon: PiggyBank, hue: 240 },
    { id: 'gift', label: 'Gift', icon: Gift, hue: 20 },
    { id: 'other', label: 'Other', icon: Sparkles },
];

export const getIncomeCategoryById = (id: string): IncomeCategory | undefined => {
    return INCOME_CATEGORIES.find(cat => cat.id === id);
};

export const getIncomeCategoryIcon = (categoryId: string): LucideIcon => {
    const category = getIncomeCategoryById(categoryId);
    return category?.icon || Sparkles;
};

export const getIncomeCategoryHue = (categoryId: string): number | undefined => {
    return getIncomeCategoryById(categoryId)?.hue;
};
