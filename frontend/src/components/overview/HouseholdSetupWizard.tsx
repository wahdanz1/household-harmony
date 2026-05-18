import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    ArrowLeft, ArrowRight, Check, Plus, Sparkles,
    CreditCard, Users,
} from "lucide-react";
import { isCategoryBudgeted } from "@/constants/expenseCategories";
import { StepIndicator, type StepIndicatorStep } from "@/components/ui/step-indicator";
import { CatIcon } from "@/components/ui/cat-icon";
import { RowItem } from "@/components/ui/row-item";
import { Money } from "@/components/ui/money";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { insuranceTypes } from "@/constants/insuranceTypes";
import { subscriptionCategories } from "@/constants/subscriptionCategories";
import { getCategoryById as getExpenseCategory } from "@/constants/expenseCategories";
import { getIncomeCategoryById } from "@/constants/incomeCategories";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import {
    useEncryptedFields,
    incomeSourceFields,
    expenseFields,
    monthlyIncomeFields,
    monthlyExpenseFields,
    subscriptionFields,
    insuranceFields,
} from "@/hooks/useEncryptedFields";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SubscriptionFormDialog } from "@/components/expenses/SubscriptionFormDialog";
import { InsuranceFormDialog } from "@/components/expenses/InsuranceFormDialog";
import { IncomeFormDialog } from "@/components/income/IncomeFormDialog";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { toast } from "sonner";

interface HouseholdSetupWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    householdId: string;
    members: Array<{ user_id: string; profiles?: { full_name?: string; email?: string } }>;
    financialMonthStart: number;
    onComplete: () => void;
}

type StepKey = "features" | "income" | "expense" | "subscription" | "insurance" | "review";
type SectionKey = Exclude<StepKey, "features" | "review">;

type FeatureKey = "credit_cards" | "shared_expenses";

interface FeatureToggle {
    key: FeatureKey;
    column: "enable_credit_cards" | "enable_shared_expenses";
    title: string;
    description: string;
    icon: any;
}

const FEATURES: FeatureToggle[] = [
    {
        key: "credit_cards",
        column: "enable_credit_cards",
        title: "Credit cards",
        description: "Track credit-card spend and import PDF invoices. Adds a Credit tab on Expenses.",
        icon: CreditCard,
    },
    {
        key: "shared_expenses",
        column: "enable_shared_expenses",
        title: "Shared with co-parent",
        description: "Split expenses with an ex-partner or co-guardian. Adds a Shared tab on Expenses.",
        icon: Users,
    },
];

interface StepConfig {
    key: StepKey;
    title: string;
    shortLabel: string;
    description: string;
    /** Empty-state nudge copy on this step (sections only). */
    empty?: string;
    /** Footer label for the "Add ..." button (sections only). */
    addLabel?: string;
}

const STEPS: StepConfig[] = [
    {
        key: "features",
        title: "Set up your first month",
        shortLabel: "Welcome",
        description: "Takes about 4 minutes. You can change everything later.",
    },
    {
        key: "income",
        title: "Income sources",
        shortLabel: "Income",
        description: "Salaries, freelance, rental income, benefits.",
        empty: "No income sources yet — start with your main salary.",
        addLabel: "Add income",
    },
    {
        key: "expense",
        title: "Fixed expenses",
        shortLabel: "Expenses",
        description: "Rent, utilities, broadband, groceries, fuel. Add one at a time.",
        empty: "No expenses yet — start with rent or your biggest monthly bill.",
        addLabel: "Add expense",
    },
    {
        key: "subscription",
        title: "Subscriptions",
        shortLabel: "Subs",
        description: "Streaming, software, gym, news.",
        empty: "No subscriptions yet — Spotify, Netflix, your favourite app…",
        addLabel: "Add subscription",
    },
    {
        key: "insurance",
        title: "Insurances",
        shortLabel: "Insurance",
        description: "Home, car, health, life. Add per provider.",
        empty: "No insurances yet — start with home insurance.",
        addLabel: "Add insurance",
    },
    {
        key: "review",
        title: "All set",
        shortLabel: "Done",
        description: "Your first month is projected below. You can adjust anytime.",
    },
];

const SECTION_TITLE: Record<SectionKey, string> = {
    income: "Income sources",
    expense: "Fixed expenses",
    subscription: "Subscriptions",
    insurance: "Insurances",
};

const SECTION_TABLE: Record<SectionKey, "income_sources" | "expenses" | "subscriptions" | "insurances"> = {
    income: "income_sources",
    expense: "expenses",
    subscription: "subscriptions",
    insurance: "insurances",
};

function iconForItem(stepKey: SectionKey, item: any): { icon: any; hue?: number } {
    if (stepKey === "income") {
        const c = getIncomeCategoryById(item.category);
        return { icon: c?.icon ?? Sparkles, hue: c?.hue };
    }
    if (stepKey === "expense") {
        const c = getExpenseCategory(item.category);
        return { icon: c?.icon ?? Sparkles, hue: c?.hue };
    }
    if (stepKey === "subscription") {
        const c = subscriptionCategories.find((s) => s.value === item.category);
        return { icon: c?.icon ?? Sparkles, hue: c?.hue };
    }
    const c = insuranceTypes.find((t) => t.value === item.category);
    return { icon: c?.icon ?? Sparkles, hue: c?.hue };
}

export const HouseholdSetupWizard = ({
    open,
    onOpenChange,
    householdId,
    members,
    financialMonthStart,
    onComplete,
}: HouseholdSetupWizardProps) => {
    const { user } = useAuth();
    const { isUnlocked, resetInactivityTimer } = useEncryption();
    const [stepIdx, setStepIdx] = useState(0);

    useEffect(() => {
        if (!open) return;
        const tick = () => resetInactivityTimer();
        tick();
        const id = window.setInterval(tick, 60_000);
        return () => window.clearInterval(id);
    }, [open, resetInactivityTimer]);
    const [items, setItems] = useState<Record<Exclude<StepKey, "features">, any[]>>({
        income: [], expense: [], subscription: [], insurance: [],
    });
    const [featureState, setFeatureState] = useState<Record<FeatureKey, boolean>>({
        credit_cards: false,
        shared_expenses: true,
    });
    const [savingFeatures, setSavingFeatures] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [finishing, setFinishing] = useState(false);
    const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
    const [discarding, setDiscarding] = useState(false);
    const [editingItem, setEditingItem] = useState<{ stepKey: SectionKey; data: any } | null>(null);
    /** Snapshot of pre-existing item IDs at wizard open. Anything not in here
     *  was added during this session and gets rolled back if the user discards. */
    const initialIdsRef = useRef<Record<SectionKey, Set<string>> | null>(null);

    const { decryptRecords: decryptIncomes } = useEncryptedFields(incomeSourceFields);
    const { decryptRecords: decryptExpenses } = useEncryptedFields(expenseFields);
    const { decryptRecords: decryptSubs } = useEncryptedFields(subscriptionFields);
    const { decryptRecords: decryptInsurances } = useEncryptedFields(insuranceFields);

    const step = STEPS[stepIdx];
    const isLast = stepIdx === STEPS.length - 1;

    const fetchAll = async () => {
        if (!isUnlocked) return;
        const [incomesR, expensesR, subsR, insurancesR] = await Promise.all([
            supabase.from("income_sources").select("*").eq("household_id", householdId).eq("is_active", true),
            supabase.from("expenses").select("*").eq("household_id", householdId).eq("is_active", true),
            supabase.from("subscriptions").select("*").eq("household_id", householdId).eq("is_active", true),
            supabase.from("insurances").select("*").eq("household_id", householdId).eq("is_active", true),
        ]);

        const [incomes, expenses, subs, insurances] = await Promise.all([
            decryptIncomes(incomesR.data ?? []),
            decryptExpenses(expensesR.data ?? []),
            decryptSubs(subsR.data ?? []),
            decryptInsurances(insurancesR.data ?? []),
        ]);

        setItems({ income: incomes, expense: expenses, subscription: subs, insurance: insurances });

        // Capture the pre-existing IDs on first fetch so we know which rows were
        // added during this wizard session (everything not in the snapshot).
        if (initialIdsRef.current === null) {
            initialIdsRef.current = {
                income: new Set(incomes.map((i: any) => i.id)),
                expense: new Set(expenses.map((i: any) => i.id)),
                subscription: new Set(subs.map((i: any) => i.id)),
                insurance: new Set(insurances.map((i: any) => i.id)),
            };
        }
    };

    /** Items added since the wizard opened, per section. */
    const addedIdsFor = (key: SectionKey): string[] => {
        const initial = initialIdsRef.current?.[key];
        if (!initial) return [];
        return items[key].filter((i: any) => !initial.has(i.id)).map((i: any) => i.id);
    };

    const totalAddedThisSession = (
        ["income", "expense", "subscription", "insurance"] as SectionKey[]
    ).reduce((sum, k) => sum + addedIdsFor(k).length, 0);

    useEffect(() => {
        if (open) {
            setStepIdx(0);
            initialIdsRef.current = null; // re-snapshot on each open
            fetchAll();
            (async () => {
                const { data } = await supabase
                    .from("households")
                    .select("enable_credit_cards, enable_shared_expenses")
                    .eq("id", householdId)
                    .single();
                if (data) {
                    setFeatureState({
                        credit_cards: !!data.enable_credit_cards,
                        shared_expenses: data.enable_shared_expenses ?? true,
                    });
                }
            })();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, householdId, isUnlocked]);

    const persistFeatures = async () => {
        setSavingFeatures(true);
        try {
            const { error } = await supabase
                .from("households")
                .update({
                    enable_credit_cards: featureState.credit_cards,
                    enable_shared_expenses: featureState.shared_expenses,
                })
                .eq("id", householdId);
            if (error) throw error;
        } catch (err: any) {
            toast.error(err.message || "Failed to save features");
        } finally {
            setSavingFeatures(false);
        }
    };

    const handleFinish = async () => {
        setFinishing(true);
        try {
            localStorage.setItem(`hh_setup_done_${householdId}`, "1");
            toast.success("Household set up. Welcome aboard!");
            // Clear the snapshot so closing doesn't trigger the discard prompt.
            initialIdsRef.current = null;
            onComplete();
            onOpenChange(false);
        } finally {
            setFinishing(false);
        }
    };

    /** Welcome-step "Skip — I'll add manually" — marks setup done so the
     *  wizard doesn't auto-reopen. User can still add data via the
     *  Income/Expenses pages directly. */
    const handleSkip = () => {
        localStorage.setItem(`hh_setup_done_${householdId}`, "1");
        initialIdsRef.current = null;
        onOpenChange(false);
    };

    const handleDialogOpenChange = (next: boolean) => {
        if (next) {
            onOpenChange(true);
            return;
        }
        if (totalAddedThisSession > 0) {
            setConfirmDiscardOpen(true);
            return;
        }
        onOpenChange(false);
    };

    const handleDiscard = async () => {
        setDiscarding(true);
        try {
            for (const key of ["income", "expense", "subscription", "insurance"] as SectionKey[]) {
                const ids = addedIdsFor(key);
                if (ids.length === 0) continue;
                const table = SECTION_TABLE[key];
                await supabase.from(table).delete().in("id", ids);
            }
            initialIdsRef.current = null;
            setConfirmDiscardOpen(false);
            onOpenChange(false);
        } finally {
            setDiscarding(false);
        }
    };

    const editDialogProps = useMemo(() => {
        if (!editingItem) return null;
        return editingItem;
    }, [editingItem]);

    /** Blur the currently-focused element before opening a child dialog —
     *  prevents the "aria-hidden on focused ancestor" warning that Radix
     *  triggers when the wizard's DialogContent gets aria-hidden while its
     *  descendant (e.g. the "Add another" button) is still focused. */
    const blurAndOpen = (fn: () => void) => {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        fn();
    };

    const isWelcomeStep = step.key === "features";
    const isReviewStep = step.key === "review";
    const sectionKey = (!isWelcomeStep && !isReviewStep) ? (step.key as SectionKey) : null;
    const stepItems = sectionKey ? items[sectionKey] : [];
    const hasAny = stepItems.length > 0;

    // Header eyebrow: "SETUP · MAY 2026"
    const todayMonth = getCurrentFinancialMonth(financialMonthStart);
    const { end: currentMonthEnd } = getFinancialMonthRange(todayMonth, financialMonthStart);
    const monthLabel = format(currentMonthEnd, "MMMM yyyy");
    const monthLabelShort = format(currentMonthEnd, "MMMM");

    // Review math — totals + amortized subs/insurance + balance + isBudgeted flag.
    const amortizeForCycle = (budget: number, cycle?: string): number => {
        if (!cycle || cycle === "monthly") return budget;
        if (cycle === "yearly") return budget / 12;
        if (cycle === "semi_annually") return budget / 6;
        if (cycle === "quarterly") return budget / 3;
        return budget;
    };
    const reviewMath = useMemo(() => {
        const inc = items.income.reduce((s, x: any) => s + (Number(x.budget) || 0), 0);
        const exp = items.expense.reduce((s, x: any) => s + (Number(x.budget) || 0), 0);
        const sub = items.subscription.reduce((s, x: any) => s + amortizeForCycle(Number(x.budget) || 0, x.billing_cycle), 0);
        const ins = items.insurance.reduce((s, x: any) => s + amortizeForCycle(Number(x.budget) || 0, x.billing_cycle), 0);
        const out = exp + sub + ins;
        const balance = inc - out;
        const hasAnyBudget = items.expense.some((x: any) => isCategoryBudgeted(x.category));
        return { inc, exp, sub, ins, out, balance, hasAnyBudget };
    }, [items]);

    const renderRow = (sk: SectionKey, it: any, last: boolean) => {
        const { icon, hue } = iconForItem(sk, it);
        const summary = summariseAmount(sk, it);
        const isBudget = sk === "expense" && isCategoryBudgeted(it.category);
        return (
            <RowItem
                key={it.id}
                last={last}
                onClick={() => blurAndOpen(() => setEditingItem({ stepKey: sk, data: it }))}
            >
                <CatIcon icon={icon} hue={hue} size={36} />
                <span className="flex-1 font-medium text-[14.5px] text-ink -tracking-[0.01em] truncate">
                    {itemLabel(sk, it)}
                </span>
                <span className="flex items-baseline gap-0.5 shrink-0">
                    <Money v={summary.amount} currency="SEK" size="base" weight={isBudget ? 500 : 600} estimate={isBudget} />
                    {summary.suffix && <span className="text-xs text-muted ml-0.5">{summary.suffix}</span>}
                </span>
            </RowItem>
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogContent
                className="!p-0 !gap-0 sm:!max-w-[840px] sm:!w-[calc(100%-2.5rem)] sm:!max-h-[calc(100%-2.5rem)] flex flex-col"
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                {/* Header strip: eyebrow on the left, X stays top-right (provided by DialogContent) */}
                <div className="px-5 sm:px-[18px] pt-4 sm:pt-3.5">
                    <span className="text-[10.5px] font-semibold tracking-[0.08em] uppercase text-muted">
                        Setup · {monthLabel}
                    </span>
                </div>

                {/* StepIndicator */}
                <div className="px-6 pt-1.5 pb-5">
                    <StepIndicator
                        steps={STEPS.map((s): StepIndicatorStep => ({ label: s.shortLabel }))}
                        current={stepIdx}
                        onJump={(i) => i < stepIdx && setStepIdx(i)}
                    />
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto pb-2.5">
                    {/* Title block — text only, no icon */}
                    <div className="px-6 pb-4">
                        <h2 className="text-[24px] font-bold -tracking-[0.02em] text-ink leading-tight">
                            {step.title}
                        </h2>
                        <p className="mt-1.5 text-sm text-ink-2 leading-[1.55] max-w-[580px]">
                            {step.description}
                        </p>
                    </div>

                    {/* Step content */}
                    <div className="px-6">
                        {isWelcomeStep ? (
                            <div className="space-y-3.5">
                                <div className="rounded-[14px] border border-line bg-surface overflow-hidden">
                                    <div className="px-4 py-3.5 flex items-center gap-3">
                                        <CatIcon icon={CreditCard} hue={50} size={36} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[14.5px] font-medium text-ink -tracking-[0.01em]">Credit cards</p>
                                            <p className="text-[12.5px] text-muted mt-0.5">Track purchases and per-card limits.</p>
                                        </div>
                                        <Switch
                                            checked={featureState.credit_cards}
                                            onCheckedChange={(v) => setFeatureState((s) => ({ ...s, credit_cards: v }))}
                                        />
                                    </div>
                                    <div className="h-px bg-line-2 mx-4" />
                                    <div className="px-4 py-3.5 flex items-center gap-3">
                                        <CatIcon icon={Users} hue={320} size={36} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[14.5px] font-medium text-ink -tracking-[0.01em]">Shared with co-parent</p>
                                            <p className="text-[12.5px] text-muted mt-0.5">Split selected expenses with another member.</p>
                                        </div>
                                        <Switch
                                            checked={featureState.shared_expenses}
                                            onCheckedChange={(v) => setFeatureState((s) => ({ ...s, shared_expenses: v }))}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-muted leading-[1.5] px-1">
                                    You can turn these on later in{" "}
                                    <strong className="font-semibold text-ink-2">Settings → Household → Extra features</strong>.
                                </p>
                            </div>
                        ) : isReviewStep ? (
                            <div className="space-y-2">
                                {/* Hero math card */}
                                <div className="rounded-[14px] border border-line bg-surface overflow-hidden mb-3.5">
                                    <div className="px-5 pt-[18px] pb-4 border-b border-line-2">
                                        <div className="text-xs font-medium tracking-[0.04em] text-muted">
                                            Left to save in {monthLabelShort}
                                        </div>
                                        <div className="mt-1 flex items-baseline gap-1.5">
                                            {reviewMath.hasAnyBudget && (
                                                <span className="text-[28px] font-medium text-accent-dk leading-none -translate-y-px">~</span>
                                            )}
                                            <span className={`font-mono tabular-nums text-[40px] font-semibold -tracking-[0.03em] leading-none ${reviewMath.balance >= 0 ? "text-accent" : "text-danger"}`}>
                                                {reviewMath.balance >= 0 ? "+" : "−"}{Math.abs(Math.round(reviewMath.balance)).toLocaleString("sv-SE")}
                                            </span>
                                            <span className="text-lg font-medium text-muted ml-1">kr</span>
                                        </div>
                                        <div className="mt-2 text-[12.5px] text-muted">
                                            <span className="font-mono tabular-nums">{Math.round(reviewMath.inc).toLocaleString("sv-SE")}</span> kr in ·{" "}
                                            <span className="font-mono tabular-nums">{Math.round(reviewMath.out).toLocaleString("sv-SE")}</span> kr out
                                        </div>
                                    </div>
                                    <div className="px-5 py-3 bg-accent-tint text-[12.5px] font-medium text-accent-dk">
                                        Ready to start {monthLabelShort} — tap <strong className="font-bold">Finish</strong> to close setup.
                                    </div>
                                </div>

                                {/* Per-section summary rows */}
                                {(["income", "expense", "subscription", "insurance"] as SectionKey[]).map((k) => {
                                    const list = items[k];
                                    const idxOfStep = STEPS.findIndex((s) => s.key === k);
                                    const total = k === "income" ? reviewMath.inc
                                        : k === "expense" ? reviewMath.exp
                                            : k === "subscription" ? reviewMath.sub
                                                : reviewMath.ins;
                                    return (
                                        <div key={k} className="rounded-[14px] border border-line bg-surface pl-[18px] pr-3 py-3 flex items-center gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-ink -tracking-[0.01em]">{SECTION_TITLE[k]}</div>
                                                <div className="text-[11.5px] text-muted mt-0.5">
                                                    <span className="font-mono tabular-nums">{list.length}</span>{" "}
                                                    {list.length === 1 ? "entry" : "entries"}
                                                </div>
                                            </div>
                                            <span className="font-mono tabular-nums text-[15px] font-semibold text-ink shrink-0">
                                                {Math.round(total).toLocaleString("sv-SE")}
                                                <span className="font-sans text-xs font-normal text-muted ml-1">kr/mo</span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setStepIdx(idxOfStep)}
                                                className="h-[30px] px-2.5 rounded-lg border border-line bg-surface hover:bg-surface-2 text-xs font-semibold text-ink-2 transition-colors shrink-0"
                                            >
                                                Add more
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : stepItems.length === 0 ? (
                            <div className="rounded-[14px] border border-dashed border-line bg-surface p-7 text-center">
                                <p className="text-[13.5px] text-muted leading-[1.55] max-w-[360px] mx-auto mb-3.5">
                                    {step.empty}
                                </p>
                                <Button variant="accentSoft" size="md" onClick={() => blurAndOpen(() => setAddOpen(true))}>
                                    <Plus className="h-4 w-4" />
                                    {step.addLabel}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <Card variant="flush">
                                    {stepItems.map((it: any, idx: number) => renderRow(sectionKey!, it, idx === stepItems.length - 1))}
                                </Card>
                                <Button variant="secondary" className="w-full" onClick={() => blurAndOpen(() => setAddOpen(true))}>
                                    <Plus className="h-4 w-4" />
                                    {step.addLabel}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-line-2 px-5 py-3.5 sm:px-5 sm:py-[14px] flex items-center gap-2.5">
                    {isWelcomeStep ? (
                        <>
                            <Button variant="ghost" onClick={handleSkip}>
                                <span className="hidden sm:inline">Skip — I'll add manually</span>
                                <span className="sm:hidden">Skip</span>
                            </Button>
                            <div className="flex-1" />
                            <Button
                                disabled={savingFeatures}
                                onClick={async () => {
                                    await persistFeatures();
                                    setStepIdx((i) => i + 1);
                                }}
                            >
                                Continue
                                <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                        </>
                    ) : isReviewStep ? (
                        <>
                            <Button variant="ghost" onClick={() => setStepIdx((i) => Math.max(0, i - 1))}>
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Back
                            </Button>
                            <div className="flex-1" />
                            <Button onClick={handleFinish} disabled={finishing}>
                                <Check className="h-4 w-4 mr-1" />
                                {finishing ? "Finishing…" : "Finish"}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setStepIdx((i) => Math.max(0, i - 1))}>
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Back
                            </Button>
                            <div className="flex-1" />
                            <Button onClick={() => setStepIdx((i) => i + 1)}>
                                Continue
                                <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>

            {sectionKey && (
                <AddItemDialog
                    open={addOpen}
                    onOpenChange={setAddOpen}
                    stepKey={sectionKey}
                    householdId={householdId}
                    userId={user?.id ?? ""}
                    members={members}
                    financialMonthStart={financialMonthStart}
                    onAdded={async () => {
                        await fetchAll();
                        setAddOpen(false);
                    }}
                />
            )}

            {editDialogProps && editDialogProps.stepKey === "income" && (
                <IncomeFormDialog
                    open={true}
                    onOpenChange={(v) => { if (!v) setEditingItem(null); }}
                    mode="edit"
                    householdId={householdId}
                    members={members}
                    financialMonthStart={financialMonthStart}
                    initialValues={{
                        id: editDialogProps.data.id,
                        category: editDialogProps.data.category,
                        name: editDialogProps.data.name,
                        provider: editDialogProps.data.provider,
                        owner_id: editDialogProps.data.owner_id,
                        budget: editDialogProps.data.budget,
                        is_shared: editDialogProps.data.is_shared,
                        co_parent_id: editDialogProps.data.co_parent_id,
                        share_percentage: editDialogProps.data.share_percentage,
                        tax_type: editDialogProps.data.tax_type,
                        custom_tax_rate: editDialogProps.data.custom_tax_rate,
                        is_active: editDialogProps.data.is_active,
                    }}
                    onSuccess={async () => { await fetchAll(); setEditingItem(null); }}
                />
            )}
            {editDialogProps && editDialogProps.stepKey === "expense" && (
                <ExpenseFormDialog
                    open={true}
                    onOpenChange={(v) => { if (!v) setEditingItem(null); }}
                    mode="edit"
                    householdId={householdId}
                    financialMonthStart={financialMonthStart}
                    showCreditToggle={false}
                    initialValues={{
                        id: editDialogProps.data.id,
                        category: editDialogProps.data.category,
                        name: editDialogProps.data.name,
                        budget: editDialogProps.data.budget,
                        is_credit: editDialogProps.data.is_credit,
                        subject_id: editDialogProps.data.subject_id,
                    }}
                    onSuccess={async () => { await fetchAll(); setEditingItem(null); }}
                />
            )}
            {editDialogProps && editDialogProps.stepKey === "subscription" && (
                <SubscriptionFormDialog
                    open={true}
                    onOpenChange={(v) => { if (!v) setEditingItem(null); }}
                    mode="edit"
                    householdId={householdId}
                    initialValues={editDialogProps.data}
                    onSuccess={async () => { await fetchAll(); setEditingItem(null); }}
                />
            )}
            {editDialogProps && editDialogProps.stepKey === "insurance" && (
                <InsuranceFormDialog
                    open={true}
                    onOpenChange={(v) => { if (!v) setEditingItem(null); }}
                    mode="edit"
                    householdId={householdId}
                    initialValues={editDialogProps.data}
                    onSuccess={async () => { await fetchAll(); setEditingItem(null); }}
                />
            )}

            <ConfirmDialog
                open={confirmDiscardOpen}
                onOpenChange={setConfirmDiscardOpen}
                title="Close setup?"
                description="What you've added won't be saved. You can start over anytime from Settings."
                confirmLabel="Close"
                busyLabel="Closing…"
                cancelLabel="Cancel"
                variant="destructive"
                busy={discarding}
                onConfirm={handleDiscard}
                stakes={{
                    eyebrow: "Being discarded",
                    items: [
                        { label: "Income sources", count: addedIdsFor("income").length },
                        { label: "Fixed expenses", count: addedIdsFor("expense").length },
                        { label: "Subscriptions", count: addedIdsFor("subscription").length },
                        { label: "Insurances", count: addedIdsFor("insurance").length },
                    ],
                }}
            />
        </Dialog>
    );
};

function itemLabel(stepKey: Exclude<StepKey, "features">, item: any): string {
    if (stepKey === "income") return item.provider || item.name || "Untitled";
    if (stepKey === "subscription") return item.service || item.name || "Untitled";
    if (stepKey === "insurance") {
        if (item.name) return item.name;
        const typeLabel = insuranceTypes.find((t) => t.value === item.category)?.label;
        if (item.provider && typeLabel) return `${item.provider} — ${typeLabel}`;
        return item.provider || typeLabel || "Untitled";
    }
    return item.name || "Untitled";
}

function summariseAmount(stepKey: Exclude<StepKey, "features">, item: any): { amount: number; suffix?: string } {
    const v = Number(item.budget ?? 0);
    const safe = Number.isNaN(v) ? 0 : v;
    if (stepKey === "subscription" && item.billing_cycle && item.billing_cycle !== "monthly") {
        return { amount: safe, suffix: `/ ${item.billing_cycle}` };
    }
    if (stepKey === "insurance" && item.billing_cycle && item.billing_cycle !== "monthly") {
        return { amount: safe, suffix: `/ ${item.billing_cycle.replace("_", " ")}` };
    }
    return { amount: safe };
}

// ---------------------------------------------------------------------------

interface AddItemDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    stepKey: Exclude<StepKey, "features">;
    householdId: string;
    userId: string;
    members: HouseholdSetupWizardProps["members"];
    financialMonthStart: number;
    onAdded: () => void;
}

const AddItemDialog = ({
    open, onOpenChange, stepKey, householdId, userId, members, financialMonthStart, onAdded,
}: AddItemDialogProps) => {
    if (stepKey === "subscription") {
        return (
            <SubscriptionFormDialog
                open={open}
                onOpenChange={onOpenChange}
                mode="add"
                householdId={householdId}
                onSuccess={onAdded}
            />
        );
    }
    if (stepKey === "insurance") {
        return (
            <InsuranceFormDialog
                open={open}
                onOpenChange={onOpenChange}
                mode="add"
                householdId={householdId}
                onSuccess={onAdded}
            />
        );
    }
    if (stepKey === "income") {
        return (
            <IncomeFormDialog
                open={open}
                onOpenChange={onOpenChange}
                mode="add"
                householdId={householdId}
                members={members}
                financialMonthStart={financialMonthStart}
                onSuccess={onAdded}
            />
        );
    }
    return (
        <ExpenseFormDialog
            open={open}
            onOpenChange={onOpenChange}
            mode="add"
            householdId={householdId}
            financialMonthStart={financialMonthStart}
            showCreditToggle={false}
            onSuccess={onAdded}
        />
    );
};

