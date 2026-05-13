import * as React from "react";
import { cn } from "@/lib/utils";

type Status = "default" | "saved" | "modified";

interface MoneyInputProps {
    value: number | string;
    onChange: (value: number) => void;
    currency?: string;
    /** Visual size */
    size?: "sm" | "base" | "lg";
    /**
     * Status indicator on the bottom border.
     *  - default: muted line
     *  - saved:   accent green (matches a smart default / last-month value)
     *  - modified: warn amber (user has overridden)
     */
    status?: Status;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    /** Pixel width — defaults responsive */
    widthClassName?: string;
    /** Pass to control onClick stopPropagation etc. */
    onClick?: React.MouseEventHandler<HTMLInputElement>;
    "aria-label"?: string;
}

const sizeMap = {
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
};

const statusBorder: Record<Status, string> = {
    default: "border-line",
    saved: "border-accent",
    modified: "border-warn",
};

/**
 * Inline-editable money input. Renders as a transparent field with a
 * 1.5px bottom-border (status-colored), tabular-nums DM Mono numerals,
 * and a muted currency suffix.
 *
 * Use this everywhere a user edits a financial value inline.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
    (
        {
            value,
            onChange,
            currency = "SEK",
            size = "base",
            status = "default",
            disabled = false,
            placeholder = "0",
            className,
            widthClassName = "w-24 sm:w-28",
            onClick,
            "aria-label": ariaLabel,
        },
        ref,
    ) => {
        // Treat 0 as empty so clearing the field doesn't repopulate it.
        const display = value === "" || value == null || value === 0
            ? ""
            : (typeof value === "number" ? Math.round(value).toString() : value.toString());

        const suffix = currency === "SEK" ? "kr" : currency;

        return (
            <span
                className={cn(
                    "inline-flex items-baseline gap-1.5",
                    "border-b-[1.5px] transition-colors",
                    "focus-within:border-accent",
                    statusBorder[status],
                    disabled && "opacity-50",
                    className,
                )}
            >
                <input
                    ref={ref}
                    type="number"
                    inputMode="numeric"
                    value={display}
                    placeholder={placeholder}
                    disabled={disabled}
                    onClick={onClick}
                    onChange={e => {
                        const raw = e.target.value;
                        const parsed = raw === "" ? 0 : parseFloat(raw);
                        onChange(Number.isFinite(parsed) ? parsed : 0);
                    }}
                    aria-label={ariaLabel}
                    className={cn(
                        "bg-transparent border-0 outline-none p-0 text-right",
                        "font-mono tabular-nums tracking-tight font-semibold",
                        sizeMap[size],
                        widthClassName,
                        "disabled:cursor-not-allowed",
                    )}
                />
                <span className="text-xs text-muted select-none whitespace-nowrap">
                    {suffix}
                </span>
            </span>
        );
    },
);
MoneyInput.displayName = "MoneyInput";
