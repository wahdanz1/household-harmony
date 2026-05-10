import { Home, Car, Heart, User, PawPrint, Plane, Scale, Baby, MoreHorizontal } from "lucide-react";
import { CategoryConfig } from "@/utils/categoryHelpers";

export const insuranceTypes: CategoryConfig[] = [
    { value: "home", label: "Home Insurance", icon: Home, hue: 50 },
    { value: "car", label: "Car Insurance", icon: Car, hue: 200 },
    { value: "health", label: "Health Insurance", icon: Heart, hue: 150 },
    { value: "child", label: "Child Insurance", icon: Baby, hue: 340 },
    { value: "life", label: "Life Insurance", icon: User, hue: 100 },
    { value: "pet", label: "Pet Insurance", icon: PawPrint, hue: 20 },
    { value: "travel", label: "Travel Insurance", icon: Plane, hue: 200 },
    { value: "liability", label: "Liability Insurance", icon: Scale, hue: 320 },
    { value: "other", label: "Other", icon: MoreHorizontal },
];

export const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
