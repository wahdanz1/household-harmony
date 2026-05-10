import { useEffect, useMemo, useState } from "react";
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
    TrendingUp, Home, Repeat, Shield,
} from "lucide-react";
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

type StepKey = "income" | "expense" | "subscription" | "insurance";

const STEPS: { key: StepKey; title: string; description: string; icon: any }[] = [
    {
        key: "income",
        title: "Income sources",
        description: "Salaries, CSN, government benefits — anything that comes in each month.",
        icon: TrendingUp,
    },
    {
        key: "expense",
        title: "Fixed expenses",
        description: "Rent, electricity, internet, phone plans — recurring bills you pay yourself.",
        icon: Home,
    },
    {
        key: "subscription",
        title: "Subscriptions",
        description: "Netflix, Spotify, software, gym — things billed monthly, quarterly, or yearly.",
        icon: Repeat,
    },
    {
        key: "insurance",
        title: "Insurances",
        description: "Home, car, health — usually billed yearly, auto-spread across the year.",
        icon: Shield,
    },
];

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
    const [items, setItems] = useState<Record<StepKey, any[]>>({
        income: [], expense: [], subscription: [], insurance: [],
    });
    const [addOpen, setAddOpen] = useState(false);
    const [finishing, setFinishing] = useState(false);

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
    };

    useEffect(() => {
        if (open) {
            setStepIdx(0);
            fetchAll();
        }
    }, [open, householdId, isUnlocked]);

    const handleFinish = async () => {
        setFinishing(true);
        try {
            localStorage.setItem(`hh_setup_done_${householdId}`, "1");
            toast.success("Household set up. Welcome aboard!");
            onComplete();
            onOpenChange(false);
        } finally {
            setFinishing(false);
        }
    };

    const stepItems = items[step.key];
    const hasAny = stepItems.length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-2xl max-h-[90vh] overflow-y-auto"
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground tracking-wide uppercase">
                        <Sparkles className="h-3.5 w-3.5 text-warning" />
                        Setup · Step {stepIdx + 1} of {STEPS.length}
                    </div>
                    <DialogTitle className="flex items-center gap-2 mt-1">
                        <step.icon className="h-5 w-5 text-info" />
                        {step.title}
                    </DialogTitle>
                    <DialogDescription>{step.description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    {stepItems.length === 0 ? (
                        <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
                            Nothing added yet. You can add what you have or skip this step.
                        </Card>
                    ) : (
                        <ul className="space-y-1.5">
                            {stepItems.map((it: any) => (
                                <li
                                    key={it.id}
                                    className="flex items-center justify-between p-3 rounded-lg border border-line"
                                >
                                    <span className="font-medium truncate">{it.name}</span>
                                    <span className="text-sm text-muted-foreground tabular-nums">
                                        {summariseAmount(step.key, it)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setAddOpen(true)}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        {hasAny ? `Add another ${step.title.slice(0, -1).toLowerCase()}` : `Add ${step.title.slice(0, -1).toLowerCase()}`}
                    </Button>
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
                    {isLast ? (
                        <Button onClick={handleFinish} disabled={finishing}>
                            <Check className="h-4 w-4 mr-2" />
                            {finishing ? "Finishing…" : "Finish setup"}
                        </Button>
                    ) : (
                        <Button onClick={() => setStepIdx((i) => i + 1)}>
                            {hasAny ? "Continue" : "Skip"}
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>

            <AddItemDialog
                open={addOpen}
                onOpenChange={setAddOpen}
                stepKey={step.key}
                householdId={householdId}
                userId={user?.id ?? ""}
                members={members}
                financialMonthStart={financialMonthStart}
                onAdded={async () => {
                    await fetchAll();
                    setAddOpen(false);
                }}
            />
        </Dialog>
    );
};

function summariseAmount(stepKey: StepKey, item: any): string {
    const v = Number(item.default_amount ?? item.amount ?? item.total_amount ?? 0);
    if (Number.isNaN(v)) return "";
    if (stepKey === "subscription" && item.billing_cycle && item.billing_cycle !== "monthly") {
        return `${Math.round(v)} kr / ${item.billing_cycle}`;
    }
    if (stepKey === "insurance" && item.payment_frequency && item.payment_frequency !== "monthly") {
        return `${Math.round(v)} kr / ${item.payment_frequency.replace("_", " ")}`;
    }
    return `${Math.round(v)} kr`;
}

// ---------------------------------------------------------------------------

interface AddItemDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    stepKey: StepKey;
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
            categoryAllowlist={["rent", "internet", "phone_plan", "electricity", "healthcare", "other"]}
            showCreditToggle={false}
            onSuccess={onAdded}
        />
    );
};

