import { Home, Car, Heart, User, PawPrint, Plane, Scale, MoreHorizontal } from "lucide-react";
import { CategoryConfig } from "@/utils/categoryHelpers";

export const insuranceTypes: CategoryConfig[] = [
    { value: "home", label: "Home Insurance", color: "#3B82F6", icon: Home },
    { value: "car", label: "Car Insurance", color: "#EF4444", icon: Car },
    { value: "health", label: "Health Insurance", color: "#10B981", icon: Heart },
    { value: "life", label: "Life Insurance", color: "#8B5CF6", icon: User },
    { value: "pet", label: "Pet Insurance", color: "#F59E0B", icon: PawPrint },
    { value: "travel", label: "Travel Insurance", color: "#06B6D4", icon: Plane },
    { value: "liability", label: "Liability Insurance", color: "#EC4899", icon: Scale },
    { value: "other", label: "Other", color: "#64748B", icon: MoreHorizontal },
];

export const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
