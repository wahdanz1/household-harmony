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
    /** Allow jumping back to a 'done' step (or staying on 'current'). Future
     *  steps remain non-clickable. */
    onJump?: (idx: number) => void;
    className?: string;
}

export const StepIndicator = ({ steps, current, showProgress = false, onJump, className }: StepIndicatorProps) => {
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
                    const clickable = !!onJump && (isDone || isCurrent);
                    const leftConnectorOn = i <= safeCurrent && i > 0;
                    const rightConnectorOn = i < safeCurrent && i < total - 1;

                    return (
                        <div key={i} className="flex-1 flex flex-col items-center min-w-0">
                            <div className="flex items-center w-full">
                                <div
                                    className={cn(
                                        "flex-1 h-0.5 rounded-sm transition-colors duration-200",
                                        i === 0 && "invisible",
                                        leftConnectorOn ? "bg-accent" : "bg-line-2",
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => clickable && onJump!(i)}
                                    disabled={!clickable}
                                    aria-current={isCurrent ? "step" : undefined}
                                    className={cn(
                                        "flex items-center justify-center h-[26px] w-[26px] rounded-full shrink-0 font-mono tabular-nums text-[12px] font-semibold leading-none transition-all duration-150",
                                        isDone && "bg-accent text-accent-ink border border-line",
                                        isCurrent && "bg-surface text-accent-dk border-2 border-accent",
                                        isNext && !isOptional && "bg-surface text-muted border border-line",
                                        isNext && isOptional && "bg-surface text-muted border-2 border-dashed border-line",
                                        clickable ? "cursor-pointer" : "cursor-default",
                                    )}
                                >
                                    {isDone ? (
                                        <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                                    ) : (
                                        <span className="block translate-y-[0.5px]">{i + 1}</span>
                                    )}
                                </button>
                                <div
                                    className={cn(
                                        "flex-1 h-0.5 rounded-sm transition-colors duration-200",
                                        i === total - 1 && "invisible",
                                        rightConnectorOn ? "bg-accent" : "bg-line-2",
                                    )}
                                />
                            </div>
                            <span
                                className={cn(
                                    "mt-1.5 text-[10.5px] text-center px-1 truncate w-full -tracking-[0.005em]",
                                    isCurrent && "font-semibold text-ink",
                                    isDone && !isCurrent && "font-medium text-ink-2",
                                    isNext && "font-medium text-muted",
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
