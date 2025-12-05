import { ShoppingCart, Fuel, ShoppingBag, UtensilsCrossed, Film, Wrench, Plane, Heart, MoreHorizontal } from "lucide-react";
import { CategoryConfig } from "@/utils/categoryHelpers";

export const creditCategories: CategoryConfig[] = [
    { value: "groceries", label: "Groceries", icon: ShoppingCart, color: "#EF4444" },
    { value: "fuel", label: "Fuel", icon: Fuel, color: "#14B8A6" },
    { value: "shopping", label: "Shopping", icon: ShoppingBag, color: "#F97316" },
    { value: "dining_out", label: "Dining Out", icon: UtensilsCrossed, color: "#EC4899" },
    { value: "entertainment", label: "Entertainment", icon: Film, color: "#8B5CF6" },
    { value: "car_repairs", label: "Car Repairs", icon: Wrench, color: "#6366F1" },
    { value: "travel", label: "Travel", icon: Plane, color: "#06B6D4" },
    { value: "healthcare", label: "Healthcare", icon: Heart, color: "#EF4444" },
    { value: "other", label: "Other", icon: MoreHorizontal, color: "#64748B" },
];
