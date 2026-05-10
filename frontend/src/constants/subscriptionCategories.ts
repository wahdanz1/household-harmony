import { Tv, Code, Music, Gamepad2, Dumbbell, Newspaper, Cloud, GraduationCap, MoreHorizontal } from "lucide-react";
import { CategoryConfig } from "@/utils/categoryHelpers";

export const subscriptionCategories: CategoryConfig[] = [
    { value: "streaming", label: "Streaming", icon: Tv, hue: 320 },
    { value: "software", label: "Software & Apps", icon: Code, hue: 240 },
    { value: "music", label: "Music", icon: Music, hue: 320 },
    { value: "gaming", label: "Gaming", icon: Gamepad2, hue: 30 },
    { value: "gym", label: "Gym & Fitness", icon: Dumbbell, hue: 150 },
    { value: "news", label: "News & Media", icon: Newspaper, hue: 240 },
    { value: "storage", label: "Cloud Storage", icon: Cloud, hue: 240 },
    { value: "education", label: "Education & Learning", icon: GraduationCap, hue: 60 },
    { value: "other", label: "Other", icon: MoreHorizontal },
];
