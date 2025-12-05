import { Briefcase, TrendingUp, HandCoins, PiggyBank, Gift, Sparkles, LucideIcon } from "lucide-react";

export interface IncomeCategory {
    id: string;
    label: string;
    icon: LucideIcon;
    color: string;
}

export const INCOME_CATEGORIES: IncomeCategory[] = [
    { id: 'salary', label: 'Salary', icon: Briefcase, color: '#10B981' },
    { id: 'business_income', label: 'Business', icon: TrendingUp, color: '#3B82F6' },
    { id: 'government_benefits', label: 'Government Benefits', icon: HandCoins, color: '#8B5CF6' },
    { id: 'investment_income', label: 'Investments', icon: PiggyBank, color: '#F59E0B' },
    { id: 'gift', label: 'Gift', icon: Gift, color: '#EC4899' },
    { id: 'other', label: 'Other', icon: Sparkles, color: '#64748B' }
];

export const getIncomeCategoryById = (id: string): IncomeCategory | undefined => {
    return INCOME_CATEGORIES.find(cat => cat.id === id);
};

export const getIncomeCategoryIcon = (categoryId: string): LucideIcon => {
    const category = getIncomeCategoryById(categoryId);
    return category?.icon || Sparkles;
};

export const getIncomeCategoryColor = (categoryId: string): string => {
    const category = getIncomeCategoryById(categoryId);
    return category?.color || '#64748B';
};
