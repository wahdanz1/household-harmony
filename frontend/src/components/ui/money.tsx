import { cn } from "@/lib/utils";

const fmtKr = (n: number, currency = "SEK") => {
    const sign = n < 0 ? "-" : "";
    const v = Math.abs(Math.round(n));
    // Non-breaking space thousand separator (sv-SE convention)
    const s = v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const suffix = currency === "SEK" ? "kr" : currency;
    return `${sign}${s} ${suffix}`;
};

interface MoneyProps {
    v: number;
    currency?: string;
    /** Tailwind text size class — default text-base */
    size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
    weight?: 400 | 500 | 600 | 700;
    /**
     * - "auto": positive=accent, negative=danger, zero=ink
     * - "ink" (default), "accent", "danger", "muted"
     */
    color?: "ink" | "accent" | "danger" | "muted" | "auto";
    className?: string;
}

const sizeClass: Record<NonNullable<MoneyProps["size"]>, string> = {
    xs: "text-xs",
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
    xl: "text-xl",
    "2xl": "text-2xl",
    "3xl": "text-3xl",
    "4xl": "text-4xl",
};

const weightClass: Record<NonNullable<MoneyProps["weight"]>, string> = {
    400: "font-normal",
    500: "font-medium",
    600: "font-semibold",
    700: "font-bold",
};

/**
 * Renders financial amounts in DM Mono with tabular-nums.
 * Always formats as Swedish currency with non-breaking space thousand separator.
 */
export const Money = ({
    v,
    currency = "SEK",
    size = "base",
    weight = 500,
    color = "ink",
    className,
}: MoneyProps) => {
    const colorClass =
        color === "auto"
            ? v > 0
                ? "text-accent"
                : v < 0
                    ? "text-danger"
                    : "text-ink"
            : color === "accent"
                ? "text-accent"
                : color === "danger"
                    ? "text-danger"
                    : color === "muted"
                        ? "text-muted"
                        : "text-ink";

    return (
        <span
            className={cn(
                "font-mono whitespace-nowrap tabular-nums tracking-tight",
                sizeClass[size],
                weightClass[weight],
                colorClass,
                className,
            )}
        >
            {fmtKr(v, currency)}
        </span>
    );
};

export { fmtKr };
