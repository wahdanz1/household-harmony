import { LucideIcon } from "lucide-react";

export interface CategoryConfig {
    value: string;
    label: string;
    /** Hue in degrees (0-360). Drives the color-mix tint. Optional — falls back to neutral. */
    hue?: number;
    /** @deprecated kept for transitional reads; prefer `hue` + tokens. */
    color?: string;
    icon: LucideIcon;
}

/**
 * Resolve a hue → reference color for accenting. Used for icon stroke colors.
 */
export const hueToOklch = (hue: number | undefined, lightness = 0.65, chroma = 0.16): string =>
    hue != null
        ? `oklch(${lightness} ${chroma} ${hue})`
        : "oklch(var(--muted))";

/**
 * Build a color-mix tinted background from a hue.
 * Adapts to theme automatically because surface-2 is theme-aware.
 */
export const hueToTintBg = (hue: number | undefined, mix = 40): string =>
    hue != null
        ? `color-mix(in oklab, oklch(var(--surface-2)) ${100 - mix}%, oklch(0.65 0.16 ${hue}) ${mix}%)`
        : "oklch(var(--surface-2))";

/**
 * Returns a colored icon element. Color derives from the category's hue
 * (theme-adaptive via OKLCH) — no hex anymore.
 */
export const getCategoryIcon = (
    categoryValue: string | null,
    categories: CategoryConfig[],
    defaultIcon: LucideIcon,
    size: string = "h-4 w-4"
) => {
    const category = categories.find((c) => c.value === categoryValue);
    const IconComponent = category?.icon || defaultIcon;
    return <IconComponent className={size} style={{ color: hueToOklch(category?.hue) }} />;
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
 * Generate a category badge with tinted bg + matching text color.
 */
export const getCategoryBadgeStyle = (
    categoryValue: string | null,
    categories: CategoryConfig[]
): { backgroundColor: string; color: string } => {
    const category = getCategoryConfig(categoryValue, categories);
    return {
        backgroundColor: hueToTintBg(category?.hue, 25),
        color: hueToOklch(category?.hue, 0.55, 0.14),
    };
};
