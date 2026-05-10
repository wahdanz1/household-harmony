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
import { SubscriptionForm } from "@/components/expenses/forms/SubscriptionForm";
import { InsuranceForm } from "@/components/expenses/forms/InsuranceForm";
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
    const { isUnlocked } = useEncryption();
    const [stepIdx, setStepIdx] = useState(0);
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
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add subscription</DialogTitle>
                        <DialogDescription>Recurring bill or service.</DialogDescription>
                    </DialogHeader>
                    <SubscriptionForm
                        householdId={householdId}
                        onSuccess={onAdded}
                        onCancel={() => onOpenChange(false)}
                    />
                </DialogContent>
            </Dialog>
        );
    }
    if (stepKey === "insurance") {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add insurance</DialogTitle>
                        <DialogDescription>
                            Yearly/semi-annual amounts are auto-spread across the months.
                        </DialogDescription>
                    </DialogHeader>
                    <InsuranceForm
                        householdId={householdId}
                        onSuccess={onAdded}
                        onCancel={() => onOpenChange(false)}
                    />
                </DialogContent>
            </Dialog>
        );
    }
    if (stepKey === "income") {
        return (
            <SimpleAddIncomeDialog
                open={open}
                onOpenChange={onOpenChange}
                householdId={householdId}
                userId={userId}
                members={members}
                financialMonthStart={financialMonthStart}
                onAdded={onAdded}
            />
        );
    }
    return (
        <SimpleAddExpenseDialog
            open={open}
            onOpenChange={onOpenChange}
            householdId={householdId}
            userId={userId}
            financialMonthStart={financialMonthStart}
            onAdded={onAdded}
        />
    );
};

// ---------------------------------------------------------------------------

interface SimpleAddIncomeDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    householdId: string;
    userId: string;
    members: HouseholdSetupWizardProps["members"];
    financialMonthStart: number;
    onAdded: () => void;
}

const INCOME_CATEGORIES = [
    { value: "salary", label: "Salary" },
    { value: "business_income", label: "Business income" },
    { value: "government_benefits", label: "Government benefits" },
    { value: "investment_income", label: "Investment income" },
    { value: "other", label: "Other" },
] as const;

const SimpleAddIncomeDialog = ({
    open, onOpenChange, householdId, userId, members, financialMonthStart, onAdded,
}: SimpleAddIncomeDialogProps) => {
    const [name, setName] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState<string>("salary");
    const [ownerId, setOwnerId] = useState(userId);
    const [saving, setSaving] = useState(false);
    const { encryptRecord: encryptSource } = useEncryptedFields(incomeSourceFields);
    const { encryptRecord: encryptMonthly } = useEncryptedFields(monthlyIncomeFields);

    useEffect(() => {
        if (open) {
            setName(""); setAmount(""); setCategory("salary"); setOwnerId(userId);
        }
    }, [open, userId]);

    const canSave = name.trim().length > 0 && parseFloat(amount) > 0 && !!ownerId;

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            const numericAmount = parseFloat(amount);
            const encryptedSource = await encryptSource({
                household_id: householdId,
                category,
                name: name.trim(),
                default_amount: numericAmount,
                created_by: ownerId,
                is_active: true,
            });

            const { data: created, error } = await (supabase as any)
                .from("income_sources")
                .insert({ ...encryptedSource, category })
                .select("id")
                .single();
            if (error || !created) throw error || new Error("Insert failed");

            const month = getCurrentFinancialMonth(financialMonthStart);
            const { start, end } = getFinancialMonthRange(month, financialMonthStart);
            const encryptedMonthly = await encryptMonthly({
                household_id: householdId,
                income_source_id: created.id,
                month,
                month_start: format(start, "yyyy-MM-dd"),
                month_end: format(end, "yyyy-MM-dd"),
                budget_amount: numericAmount,
                created_by: ownerId,
            });
            await (supabase as any)
                .from("monthly_incomes")
                .insert(encryptedMonthly);

            onAdded();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to add income");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add income source</DialogTitle>
                    <DialogDescription>Recurring monthly income.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {INCOME_CATEGORIES.map(c => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daniel salary" />
                    </div>
                    <div className="space-y-2">
                        <Label>Belongs to</Label>
                        <Select value={ownerId} onValueChange={setOwnerId}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {members.map(m => (
                                    <SelectItem key={m.user_id} value={m.user_id}>
                                        {m.profiles?.full_name || m.profiles?.email || m.user_id.slice(0, 8)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Monthly amount (kr)</Label>
                        <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={!canSave || saving}>
                        {saving ? "Adding…" : "Add"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ---------------------------------------------------------------------------

interface SimpleAddExpenseDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    householdId: string;
    userId: string;
    financialMonthStart: number;
    onAdded: () => void;
}

const FIXED_EXPENSE_CATEGORIES = [
    { value: "rent", label: "Rent" },
    { value: "electricity", label: "Electricity" },
    { value: "internet", label: "Internet" },
    { value: "phone_plan", label: "Phone plan" },
    { value: "other", label: "Other" },
] as const;

const SimpleAddExpenseDialog = ({
    open, onOpenChange, householdId, userId, financialMonthStart, onAdded,
}: SimpleAddExpenseDialogProps) => {
    const [name, setName] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState<string>("rent");
    const [saving, setSaving] = useState(false);
    const { encryptRecord: encryptExpense } = useEncryptedFields(expenseFields);
    const { encryptRecord: encryptMonthly } = useEncryptedFields(monthlyExpenseFields);

    useEffect(() => {
        if (open) { setName(""); setAmount(""); setCategory("rent"); }
    }, [open]);

    const canSave = name.trim().length > 0 && parseFloat(amount) > 0;

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            const numericAmount = parseFloat(amount);
            const encryptedExpense = await encryptExpense({
                household_id: householdId,
                category,
                name: name.trim(),
                default_amount: numericAmount,
                created_by: userId,
                is_active: true,
                is_credit: false,
                sort_order: 0,
            });

            const { data: created, error } = await (supabase as any)
                .from("expenses")
                .insert({ ...encryptedExpense, category })
                .select("id")
                .single();
            if (error || !created) throw error || new Error("Insert failed");

            const month = getCurrentFinancialMonth(financialMonthStart);
            const { start, end } = getFinancialMonthRange(month, financialMonthStart);
            const encryptedMonthly = await encryptMonthly({
                household_id: householdId,
                expense_id: created.id,
                month,
                month_start: format(start, "yyyy-MM-dd"),
                month_end: format(end, "yyyy-MM-dd"),
                budget_amount: numericAmount,
                created_by: userId,
            });
            await (supabase as any)
                .from("monthly_expenses")
                .insert(encryptedMonthly);

            onAdded();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to add expense");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add fixed expense</DialogTitle>
                    <DialogDescription>Rent, utilities — bills you pay yourself each month.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {FIXED_EXPENSE_CATEGORIES.map(c => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hyra" />
                    </div>
                    <div className="space-y-2">
                        <Label>Monthly amount (kr)</Label>
                        <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={!canSave || saving}>
                        {saving ? "Adding…" : "Add"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
