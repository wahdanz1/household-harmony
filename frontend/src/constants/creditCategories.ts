import { ShoppingCart, Fuel, ShoppingBag, UtensilsCrossed, Film, Wrench, Plane, Heart, MoreHorizontal } from "lucide-react";
import { CategoryConfig } from "@/utils/categoryHelpers";

export const creditCategories: CategoryConfig[] = [
    { value: "groceries", label: "Groceries", icon: ShoppingCart, hue: 80 },
    { value: "fuel", label: "Fuel", icon: Fuel, hue: 200 },
    { value: "shopping", label: "Shopping", icon: ShoppingBag, hue: 320 },
    { value: "dining_out", label: "Dining Out", icon: UtensilsCrossed, hue: 80 },
    { value: "entertainment", label: "Entertainment", icon: Film, hue: 320 },
    { value: "car_repairs", label: "Car Repairs", icon: Wrench, hue: 200 },
    { value: "travel", label: "Travel", icon: Plane, hue: 200 },
    { value: "healthcare", label: "Healthcare", icon: Heart, hue: 150 },
    { value: "other", label: "Other", icon: MoreHorizontal },
];
