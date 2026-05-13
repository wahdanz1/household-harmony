import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface SectionFrame {
    /** Numeric value (rounded for display). */
    v: number;
    /** Unit suffix, e.g. "kr/mån", "kr/år", "kr". */
    unit: string;
    /** Optional label before the value, e.g. "varav budget", "snitt/post". */
    label?: string;
    /** Mark the primary headline frame — bolder ink. First true wins. */
    primary?: boolean;
}

interface SectionFramesProps {
    frames: SectionFrame[];
    /** Hide non-primary frames below sm breakpoint. Default true. */
    collapseOnMobile?: boolean;
    className?: string;
}

const fmt = (v: number) => {
    const sign = v < 0 ? "-" : "";
    const a = Math.abs(Math.round(v));
    return sign + a.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

/**
 * Section-header triple-frame totals. Renders inline `primary · year · contextual`
 * with a thin separator between frames. Non-primary frames collapse on mobile by
 * default so headers don't overflow. See docs/design/drift-audit.md § 3.
 */
export const SectionFrames = ({ frames, collapseOnMobile = true, className }: SectionFramesProps) => {
    return (
        <div className={cn("inline-flex items-baseline gap-2.5 flex-wrap", className)}>
            {frames.map((f, i) => {
                const hideOnMobile = collapseOnMobile && !f.primary;
                return (
                    <Fragment key={i}>
                        {i > 0 && (
                            <span
                                aria-hidden
                                className={cn(
                                    "w-px h-3 bg-line self-center",
                                    hideOnMobile && "hidden sm:inline-block",
                                )}
                            />
                        )}
                        <span
                            className={cn(
                                "inline-flex items-baseline gap-1 text-[11.5px] text-muted",
                                hideOnMobile && "hidden sm:inline-flex",
                            )}
                        >
                            {f.label && <span>{f.label}</span>}
                            <span
                                className={cn(
                                    "font-mono tabular-nums",
                                    f.primary
                                        ? "text-[13.5px] font-semibold text-ink"
                                        : "text-[12.5px] font-medium text-ink-2",
                                )}
                            >
                                {fmt(f.v)}
                            </span>
                            <span>{f.unit}</span>
                        </span>
                    </Fragment>
                );
            })}
        </div>
    );
};
