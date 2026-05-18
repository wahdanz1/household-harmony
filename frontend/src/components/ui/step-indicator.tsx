import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepIndicatorStep {
    label: string;
    optional?: boolean;
}

interface StepIndicatorProps {
    steps: StepIndicatorStep[];
    /** 0-indexed current step. Steps before this render as 'done', after as 'next'. */
    current: number;
    /** Render the "Step N of M ·· X%" line below the nodes. Default off — the
     *  step labels and visual progress already communicate this. */
    showProgress?: boolean;
    className?: string;
}

export const StepIndicator = ({ steps, current, showProgress = false, className }: StepIndicatorProps) => {
    const total = steps.length;
    const safeCurrent = Math.max(0, Math.min(total - 1, current));
    const percent = Math.round((safeCurrent / total) * 100);

    return (
        <div className={cn("w-full", className)}>
            <div className="flex items-start">
                {steps.map((step, i) => {
                    const isDone = i < safeCurrent;
                    const isCurrent = i === safeCurrent;
                    const isNext = i > safeCurrent;
                    const isOptional = !!step.optional;
                    const leftConnectorOn = i <= safeCurrent && i > 0;
                    const rightConnectorOn = i < safeCurrent && i < total - 1;

                    return (
                        <div key={i} className="flex-1 flex flex-col items-center min-w-0">
                            <div className="flex items-center w-full">
                                <div
                                    className={cn(
                                        "flex-1 h-0.5",
                                        i === 0 && "invisible",
                                        leftConnectorOn ? "bg-accent" : "bg-line",
                                    )}
                                />
                                <div
                                    className={cn(
                                        "flex items-center justify-center h-8 w-8 rounded-full shrink-0 text-xs font-medium tabular-nums",
                                        isDone && "bg-accent text-accent-ink",
                                        isCurrent && "border-2 border-accent text-accent bg-bg",
                                        isNext && !isOptional && "border border-line text-muted bg-bg",
                                        isNext && isOptional && "border-2 border-dashed border-line text-muted bg-bg",
                                    )}
                                    aria-current={isCurrent ? "step" : undefined}
                                >
                                    {isDone ? <Check className="h-4 w-4" /> : i + 1}
                                </div>
                                <div
                                    className={cn(
                                        "flex-1 h-0.5",
                                        i === total - 1 && "invisible",
                                        rightConnectorOn ? "bg-accent" : "bg-line",
                                    )}
                                />
                            </div>
                            <span
                                className={cn(
                                    "mt-2 text-[11px] text-center px-1 truncate w-full",
                                    isCurrent && "font-medium text-ink",
                                    !isCurrent && "text-muted",
                                )}
                                title={step.label}
                            >
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
            {showProgress && (
                <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted tracking-wide uppercase">
                        Step {safeCurrent + 1} of {total}
                    </span>
                    <span className="font-medium text-accent tabular-nums">{percent}%</span>
                </div>
            )}
        </div>
    );
};
