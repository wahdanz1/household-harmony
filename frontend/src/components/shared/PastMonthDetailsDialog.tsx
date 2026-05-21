import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { CatIcon } from "@/components/ui/cat-icon";
import { CreditCard, User, Zap, Box, Car, Baby, PawPrint, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format } from "date-fns";

const SUBJECT_TYPE_ICON: Record<string, LucideIcon> = {
    car: Car,
    kid: Baby,
    pet: PawPrint,
    other: Box,
};

export interface PastMonthDetailsItem {
    name: string;
    categoryLabel?: string;
    icon?: LucideIcon;
    hue?: number;
    currency: string;
    /** Planned amount (budget snapshot for source-tied rows). Omitted for one-time entries. */
    budget?: number;
    /** Realised amount for the month. Always set for one-time entries; may be absent for unreconciled source-tied rows. */
    actualAmount?: number;
    /** Audit metadata from monthly_*: was budget changed mid-month? */
    previousBudgetSnapshot?: number;
    budgetChangedAt?: string;
    /** Audit metadata: was actual recorded outside Review (via Mark paid)? */
    actualRecordedAt?: string;
    /** Audit metadata: was source inactivated mid-month? */
    inactivatedAt?: string;
    subject?: { name: string; type: string };
    member?: { name: string };
    isCredit?: boolean;
    isOneOff?: boolean;
    /** Per-cycle display label for subs/insurance, e.g. "/year". */
    billingLabel?: string;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: PastMonthDetailsItem | null;
}

const SubjectChip = ({ subject }: { subject: { name: string; type: string } }) => {
    const Icon = SUBJECT_TYPE_ICON[subject.type] ?? Box;
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-2 text-muted">
            <Icon className="h-3 w-3" />
            {subject.name}
        </span>
    );
};

const MemberChip = ({ member }: { member: { name: string } }) => (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-2 text-muted">
        <User className="h-3 w-3" />
        {member.name}
    </span>
);

const CreditChip = () => (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-2 text-muted">
        <CreditCard className="h-3 w-3" />
        Credit
    </span>
);

const OneOffChip = () => (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-2 text-muted">
        <Zap className="h-3 w-3" />
        One-off
    </span>
);

export const PastMonthDetailsDialog = ({ open, onOpenChange, item }: Props) => {
    if (!item) return null;

    const Icon = item.icon ?? Sparkles;
    const hasBudget = item.budget !== undefined;
    const hasActual = item.actualAmount !== undefined;
    const variance = hasBudget && hasActual ? item.actualAmount! - item.budget! : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 min-w-0">
                        <CatIcon icon={Icon} hue={item.hue} size={36} />
                        <div className="flex-1 min-w-0">
                            <div className="truncate">{item.name}</div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {item.subject && <SubjectChip subject={item.subject} />}
                                {item.member && <MemberChip member={item.member} />}
                                {item.isCredit && <CreditChip />}
                                {item.isOneOff && <OneOffChip />}
                            </div>
                        </div>
                    </DialogTitle>
                    {item.categoryLabel && (
                        <DialogDescription>{item.categoryLabel}</DialogDescription>
                    )}
                </DialogHeader>

                <div className="space-y-3 py-2">
                    {hasBudget && (
                        <div className="flex items-baseline justify-between">
                            <span className="text-sm text-muted">Planned</span>
                            <span className="flex items-baseline gap-1">
                                <Money v={item.budget!} currency={item.currency} weight={500} />
                                {item.billingLabel && <span className="text-xs text-muted">{item.billingLabel}</span>}
                            </span>
                        </div>
                    )}

                    {hasActual && (
                        <div className="flex items-baseline justify-between">
                            <span className="text-sm text-muted">Actual</span>
                            <span className="flex items-baseline gap-1">
                                <Money v={item.actualAmount!} currency={item.currency} weight={600} />
                                {!hasBudget && item.billingLabel && (
                                    <span className="text-xs text-muted">{item.billingLabel}</span>
                                )}
                            </span>
                        </div>
                    )}

                    {variance != null && Math.round(variance) !== 0 && (
                        <div className="flex items-baseline justify-between">
                            <span className="text-sm text-muted">Variance</span>
                            <span className={`text-sm font-semibold tabular-nums ${variance > 0 ? "text-danger" : "text-accent"}`}>
                                {variance > 0 ? "+" : "−"}{Math.abs(Math.round(variance)).toLocaleString("sv-SE")} {item.currency}
                            </span>
                        </div>
                    )}

                    {(item.budgetChangedAt || item.actualRecordedAt || item.inactivatedAt) && (
                        <div className="pt-2 border-t border-line-2 space-y-1.5">
                            {item.budgetChangedAt && item.previousBudgetSnapshot != null && (
                                <p className="text-xs text-muted">
                                    Budget changed {format(new Date(item.budgetChangedAt), "d MMM")} — was{" "}
                                    {Math.round(item.previousBudgetSnapshot).toLocaleString("sv-SE")} {item.currency}
                                </p>
                            )}
                            {item.actualRecordedAt && (
                                <p className="text-xs text-muted">
                                    Actual recorded {format(new Date(item.actualRecordedAt), "d MMM")} (outside Review)
                                </p>
                            )}
                            {item.inactivatedAt && (
                                <p className="text-xs text-muted">
                                    Inactivated {format(new Date(item.inactivatedAt), "d MMM")}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
