import { LucideIcon } from "lucide-react";

export interface CategoryConfig {
    value: string;
    label: string;
    color: string;
    icon: LucideIcon;
}

/**
 * Generic function to get icon component for a category
 */
export const getCategoryIcon = (
    categoryValue: string | null,
    categories: CategoryConfig[],
    defaultIcon: LucideIcon,
    size: string = "h-4 w-4"
) => {
    const category = categories.find((c) => c.value === categoryValue);
    const IconComponent = category?.icon || defaultIcon;
    const color = category?.color || "#64748B";

    return <IconComponent className={size} style={{ color }} />;
};

/**
 * Get category configuration by value
 */
export const getCategoryConfig = (
    categoryValue: string | null,
    categories: CategoryConfig[]
): CategoryConfig | undefined => {
    return categories.find((c) => c.value === categoryValue);
};

/**
 * Generate a category badge with background color and text color
 */
export const getCategoryBadgeStyle = (
    categoryValue: string | null,
    categories: CategoryConfig[]
): { backgroundColor: string; color: string } => {
    const category = getCategoryConfig(categoryValue, categories);
    const color = category?.color || "#64748B";

    return {
        backgroundColor: `${color}20`,
        color,
    };
};
