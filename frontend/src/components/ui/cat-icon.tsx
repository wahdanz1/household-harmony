import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CatIconProps {
    icon: LucideIcon;
    /**
     * Hue in degrees (0-360). Determines the tinted background.
     * If undefined, renders with a neutral muted background.
     *
     * Design's category palette:
     *   housing 50, food 80, transport 200, energy 30, health 150,
     *   phone 260, media 320, card 240, insurance 100, work 60, family 20
     */
    hue?: number;
    /** Size in pixels — default 36 */
    size?: number;
    className?: string;
}

/**
 * Square category icon tile.
 *
 * Background uses `color-mix(in oklab, surface-2 60%, oklch(0.65 0.16 <hue>) 40%)`.
 * Surface-2 is theme-aware, so the tint adapts: pastel in light mode, muted-deep
 * in dark mode. Pure-saturated reference color keeps the hue identity consistent.
 *
 * If no `hue` is given, renders with surface-2 background (neutral category).
 */
export const CatIcon = ({ icon: Icon, hue, size = 36, className }: CatIconProps) => {
    const tone = hue != null ? `oklch(0.65 0.16 ${hue})` : null;
    const bg = tone
        ? `color-mix(in oklab, oklch(var(--surface-2)) 60%, ${tone} 40%)`
        : "oklch(var(--surface-2))";

    return (
        <div
            className={cn("flex items-center justify-center shrink-0 text-ink", className)}
            style={{
                width: size,
                height: size,
                borderRadius: Math.round(size * 0.32),
                background: bg,
            }}
        >
            <Icon size={Math.round(size * 0.5)} strokeWidth={1.8} />
        </div>
    );
};
