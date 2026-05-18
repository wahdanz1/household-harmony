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
    ArrowLeft, ArrowRight, Check, Plus, ClipboardCheck, Sparkles,
    TrendingUp, Home, Repeat, Shield, ToggleRight, CreditCard, Users,
} from "lucide-react";
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

const STEPS: { key: StepKey; title: string; shortLabel: string; description: string; icon: any }[] = [
    {
        key: "features",
        title: "Features",
        shortLabel: "Features",
        description: "Pick what you want to track. You can always change this later in Settings.",
        icon: ToggleRight,
    },
    {
        key: "income",
        title: "Income sources",
        shortLabel: "Income",
        description: "Salaries, benefits, and any other regular income coming in each month.",
        icon: TrendingUp,
    },
    {
        key: "expense",
        title: "Fixed expenses",
        shortLabel: "Expenses",
        description: "Recurring bills you pay yourself — rent, utilities, phone plans, anything monthly.",
        icon: Home,
    },
    {
        key: "subscription",
        title: "Subscriptions",
        shortLabel: "Subs",
        description: "Streaming, software, gym, memberships — anything billed on a regular cycle.",
        icon: Repeat,
    },
    {
        key: "insurance",
        title: "Insurances",
        shortLabel: "Insurance",
        description: "Home, car, health, pet — usually billed yearly, auto-spread across the year.",
        icon: Shield,
    },
    {
        key: "review",
        title: "Review",
        shortLabel: "Review",
        description: "Quick check of what you've added. Tap any row to edit. Click Finish when you're ready.",
        icon: ClipboardCheck,
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

    const isFeatureStep = step.key === "features";
    const isReviewStep = step.key === "review";
    const sectionKey = (!isFeatureStep && !isReviewStep) ? (step.key as SectionKey) : null;
    const stepItems = sectionKey ? items[sectionKey] : [];
    const hasAny = stepItems.length > 0;

    const renderRow = (sk: SectionKey, it: any, last: boolean) => {
        const { icon, hue } = iconForItem(sk, it);
        const summary = summariseAmount(sk, it);
        return (
            <RowItem
                key={it.id}
                last={last}
                onClick={() => setEditingItem({ stepKey: sk, data: it })}
            >
                <CatIcon icon={icon} hue={hue} size={32} />
                <span className="flex-1 font-medium text-sm sm:text-base truncate">
                    {itemLabel(sk, it)}
                </span>
                <span className="flex items-baseline gap-1 shrink-0">
                    <Money v={summary.amount} currency="SEK" size="base" weight={500} />
                    {summary.suffix && <span className="text-xs text-muted">{summary.suffix}</span>}
                </span>
            </RowItem>
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogContent
                className="max-w-2xl max-h-[90vh] overflow-y-auto"
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <StepIndicator
                    steps={STEPS.map((s): StepIndicatorStep => ({ label: s.shortLabel }))}
                    current={stepIdx}
                    className="pt-1 pb-2"
                />
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 mt-1">
                        <step.icon className="h-5 w-5 text-accent" />
                        {step.title}
                    </DialogTitle>
                    <DialogDescription>{step.description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    {isFeatureStep ? (
                        <ul className="space-y-2">
                            {FEATURES.map((f) => {
                                const Icon = f.icon;
                                return (
                                    <li
                                        key={f.key}
                                        className="flex items-start gap-3 p-3 rounded-lg border border-line"
                                    >
                                        <Icon className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium">{f.title}</p>
                                            <p className="text-sm text-muted">{f.description}</p>
                                        </div>
                                        <Switch
                                            checked={featureState[f.key]}
                                            onCheckedChange={(v) => setFeatureState((s) => ({ ...s, [f.key]: v }))}
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    ) : isReviewStep ? (
                        <div className="space-y-5">
                            {(["income", "expense", "subscription", "insurance"] as SectionKey[]).map((k) => {
                                const list = items[k];
                                const idxOfStep = STEPS.findIndex((s) => s.key === k);
                                return (
                                    <div key={k} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-medium text-ink">
                                                {SECTION_TITLE[k]} <span className="text-muted tabular-nums">{list.length}</span>
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() => setStepIdx(idxOfStep)}
                                                className="text-xs text-accent-dk hover:underline"
                                            >
                                                {list.length === 0 ? "Add now" : "Add more"}
                                            </button>
                                        </div>
                                        {list.length === 0 ? (
                                            <Card className="p-3 text-center text-xs text-muted border-dashed">
                                                Nothing added.
                                            </Card>
                                        ) : (
                                            <Card variant="flush">
                                                {list.map((it: any, idx: number) => renderRow(k, it, idx === list.length - 1))}
                                            </Card>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : stepItems.length === 0 ? (
                        <Card className="p-6 text-center text-sm text-muted border-dashed">
                            Nothing added yet. You can add what you have or skip this step.
                        </Card>
                    ) : (
                        <Card variant="flush">
                            {stepItems.map((it: any, idx: number) => renderRow(sectionKey!, it, idx === stepItems.length - 1))}
                        </Card>
                    )}

                    {sectionKey && (
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => setAddOpen(true)}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            {hasAny ? `Add another ${step.title.slice(0, -1).toLowerCase()}` : `Add ${step.title.slice(0, -1).toLowerCase()}`}
                        </Button>
                    )}
                </div>

                <DialogFooter className="flex-row justify-between sm:justify-between">
                    <Button
                        variant="ghost"
                        onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                        disabled={stepIdx === 0}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    {isReviewStep ? (
                        <Button onClick={handleFinish} disabled={finishing}>
                            <Check className="h-4 w-4 mr-2" />
                            {finishing ? "Finishing…" : "Finish setup"}
                        </Button>
                    ) : (
                        <Button
                            disabled={isFeatureStep && savingFeatures}
                            onClick={async () => {
                                if (isFeatureStep) await persistFeatures();
                                setStepIdx((i) => i + 1);
                            }}
                        >
                            {isFeatureStep ? "Continue" : (hasAny ? "Continue" : "Skip")}
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    )}
                </DialogFooter>
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
                title="Discard your setup progress?"
                description={`You've added ${totalAddedThisSession} item${totalAddedThisSession === 1 ? "" : "s"} during this setup. Closing now will remove them. You can re-open setup from the Overview later to start fresh.`}
                busy={discarding}
                onConfirm={handleDiscard}
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

