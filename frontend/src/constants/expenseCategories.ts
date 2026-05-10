import { Home, Wifi, Smartphone, Zap, ShoppingCart, UtensilsCrossed, Film, ShoppingBag, Fuel, Wrench, CreditCard, Heart, Sparkles, Plane, Users2, LucideIcon } from "lucide-react";

export interface ExpenseCategory {
    id: string;
    label: string;
    icon: LucideIcon;
    /** Hue in degrees (0-360) — drives theme-adaptive color-mix tint. */
    hue?: number;
}

/**
 * Hue palette (from chlorophyll design language):
 *   housing 50, food 80, transport 200, energy 30, health 150,
 *   phone 260, media 320, card 240, insurance 100, work 60, family 20
 */
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
    { id: 'rent', label: 'Rent', icon: Home, hue: 50 },
    { id: 'internet', label: 'Internet', icon: Wifi, hue: 200 },
    { id: 'phone_plan', label: 'Phone Plan', icon: Smartphone, hue: 260 },
    { id: 'electricity', label: 'Electricity', icon: Zap, hue: 30 },
    { id: 'groceries', label: 'Groceries', icon: ShoppingCart, hue: 80 },
    { id: 'dining_out', label: 'Dining Out', icon: UtensilsCrossed, hue: 80 },
    { id: 'entertainment', label: 'Entertainment', icon: Film, hue: 320 },
    { id: 'shopping', label: 'Shopping', icon: ShoppingBag, hue: 320 },
    { id: 'fuel', label: 'Fuel', icon: Fuel, hue: 200 },
    { id: 'travel', label: 'Travel', icon: Plane, hue: 200 },
    { id: 'car_repairs', label: 'Car Repairs', icon: Wrench, hue: 200 },
    { id: 'credit_card', label: 'Credit Card', icon: CreditCard, hue: 240 },
    { id: 'healthcare', label: 'Healthcare', icon: Heart, hue: 150 },
    { id: 'memberships', label: 'Memberships & dues', icon: Users2, hue: 100 },
    { id: 'other', label: 'Other', icon: Sparkles },
];

export const getCategoryById = (id: string): ExpenseCategory | undefined => {
    return EXPENSE_CATEGORIES.find(cat => cat.id === id);
};

export const getCategoryIcon = (categoryId: string): LucideIcon => {
    const category = getCategoryById(categoryId);
    return category?.icon || Sparkles;
};

export const getCategoryHue = (categoryId: string): number | undefined => {
    return getCategoryById(categoryId)?.hue;
};
