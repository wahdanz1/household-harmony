import { Wrench, Heart, Hammer, ShoppingBag, Gift, Plane, MoreHorizontal, LucideIcon } from "lucide-react";
import { getCategoryById } from "./expenseCategories";

export interface OneOffCategory {
    value: string;
    label: string;
    icon: LucideIcon;
    hue?: number;
}

export const oneOffExpenseCategories: OneOffCategory[] = [
    { value: "car_repair", label: "Car repair", icon: Wrench, hue: 200 },
    { value: "medical", label: "Medical", icon: Heart, hue: 150 },
    { value: "home_repair", label: "Home repair", icon: Hammer, hue: 50 },
    { value: "shopping", label: "Shopping", icon: ShoppingBag, hue: 320 },
    { value: "gift", label: "Gift", icon: Gift, hue: 20 },
    { value: "travel", label: "Travel", icon: Plane, hue: 200 },
    { value: "other", label: "Other", icon: MoreHorizontal },
];

// A one-off value can come from the manual picker (above) OR credit-import,
// whose values live in EXPENSE_CATEGORIES — fall through to that for icon/label.
export const getOneOffCategory = (value?: string | null) => {
    if (!value) return undefined;
    const own = oneOffExpenseCategories.find(c => c.value === value);
    if (own) return { icon: own.icon, hue: own.hue, label: own.label };
    const expense = getCategoryById(value);
    return expense ? { icon: expense.icon, hue: expense.hue, label: expense.label } : undefined;
};
