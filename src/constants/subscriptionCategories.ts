import { Tv, Code, Music, Gamepad2, Dumbbell, Newspaper, Cloud, GraduationCap, MoreHorizontal } from "lucide-react";
import { CategoryConfig } from "@/utils/categoryHelpers";

export const subscriptionCategories: CategoryConfig[] = [
    { value: "streaming", label: "Streaming", color: "#EC4899", icon: Tv },
    { value: "software", label: "Software & Apps", color: "#8B5CF6", icon: Code },
    { value: "music", label: "Music", color: "#10B981", icon: Music },
    { value: "gaming", label: "Gaming", color: "#F59E0B", icon: Gamepad2 },
    { value: "gym", label: "Gym & Fitness", color: "#EF4444", icon: Dumbbell },
    { value: "news", label: "News & Media", color: "#3B82F6", icon: Newspaper },
    { value: "storage", label: "Cloud Storage", color: "#06B6D4", icon: Cloud },
    { value: "education", label: "Education & Learning", color: "#A855F7", icon: GraduationCap },
    { value: "other", label: "Other", color: "#64748B", icon: MoreHorizontal },
];
