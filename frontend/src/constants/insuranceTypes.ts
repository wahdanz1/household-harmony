import { Home, Car, Heart, User, PawPrint, Plane, Scale, Baby, MoreHorizontal } from "lucide-react";
import { CategoryConfig } from "@/utils/categoryHelpers";

export const insuranceTypes: CategoryConfig[] = [
    { value: "home", label: "Home", icon: Home, hue: 50 },
    { value: "car", label: "Car", icon: Car, hue: 200 },
    { value: "health", label: "Health", icon: Heart, hue: 150 },
    { value: "child", label: "Child", icon: Baby, hue: 340 },
    { value: "life", label: "Life", icon: User, hue: 100 },
    { value: "pet", label: "Pet", icon: PawPrint, hue: 20 },
    { value: "travel", label: "Travel", icon: Plane, hue: 200 },
    { value: "liability", label: "Liability", icon: Scale, hue: 320 },
    { value: "other", label: "Other", icon: MoreHorizontal },
];

export const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
