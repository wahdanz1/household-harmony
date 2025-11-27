import { Home, Wifi, Smartphone, Zap, ShoppingCart, UtensilsCrossed, Film, ShoppingBag, Fuel, Wrench, CreditCard, Heart, Sparkles, LucideIcon } from "lucide-react";

export interface ExpenseCategory {
    id: string;
    label: string;
    icon: LucideIcon;
    color: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
    { id: 'rent', label: 'Rent', icon: Home, color: '#8B5CF6' },
    { id: 'internet', label: 'Internet', icon: Wifi, color: '#3B82F6' },
    { id: 'phone_plan', label: 'Phone Plan', icon: Smartphone, color: '#10B981' },
    { id: 'electricity', label: 'Electricity', icon: Zap, color: '#F59E0B' },
    { id: 'groceries', label: 'Groceries', icon: ShoppingCart, color: '#EF4444' },
    { id: 'dining_out', label: 'Dining Out', icon: UtensilsCrossed, color: '#EC4899' },
    { id: 'entertainment', label: 'Entertainment', icon: Film, color: '#8B5CF6' },
    { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: '#F97316' },
    { id: 'fuel', label: 'Fuel', icon: Fuel, color: '#14B8A6' },
    { id: 'car_repairs', label: 'Car Repairs', icon: Wrench, color: '#6366F1' },
    { id: 'credit_card', label: 'Credit Card', icon: CreditCard, color: '#A855F7' },
    { id: 'healthcare', label: 'Healthcare', icon: Heart, color: '#EF4444' },
    { id: 'other', label: 'Other', icon: Sparkles, color: '#64748B' }
];

export const getCategoryById = (id: string): ExpenseCategory | undefined => {
    return EXPENSE_CATEGORIES.find(cat => cat.id === id);
};

export const getCategoryIcon = (categoryId: string): LucideIcon => {
    const category = getCategoryById(categoryId);
    return category?.icon || Sparkles;
};

export const getCategoryColor = (categoryId: string): string => {
    const category = getCategoryById(categoryId);
    return category?.color || '#64748B';
};
