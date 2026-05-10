import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreditCard, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    useEncryptedFields,
    expenseFields,
    monthlyExpenseFields,
} from "@/hooks/useEncryptedFields";
import { EXPENSE_CATEGORIES } from "@/constants/expenseCategories";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
import { useUsedCategoryValues } from "@/hooks/useUsedCategoryValues";
import { SubjectPicker } from "@/components/shared/SubjectPicker";

interface InitialValues {
    id?: string;
    category?: string;
    name?: string;
    default_amount?: number | string;
    is_credit?: boolean;
    subject_id?: string | null;
}

interface ExpenseFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: "add" | "edit";
    householdId: string;
    financialMonthStart: number;
    initialValues?: InitialValues;
    /** Limit which categories show in the dropdown (defaults to all). */
    categoryAllowlist?: string[];
    /** Show the credit-card toggle. Hidden by default in the wizard. */
    showCreditToggle?: boolean;
    onSuccess?: () => void;
}

const blankForm: InitialValues = {
    category: "rent",
    name: "",
    default_amount: "0",
    is_credit: false,
    subject_id: null,
};

export const ExpenseFormDialog = ({
    open, onOpenChange, mode, householdId, financialMonthStart,
    initialValues, categoryAllowlist, showCreditToggle = true, onSuccess,
}: ExpenseFormDialogProps) => {
    const { user } = useAuth();
    const [form, setForm] = useState<InitialValues>(() => ({ ...blankForm, ...initialValues }));
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [createAnother, setCreateAnother] = useState(false);

    const { encryptRecord: encryptExpense } = useEncryptedFields(expenseFields);
    const { encryptRecord: encryptMonthly } = useEncryptedFields(monthlyExpenseFields);

    useEffect(() => {
        if (!open) return;
        setForm({ ...blankForm, ...initialValues });
        setCreateAnother(false);
    }, [open, initialValues]);

    const editingId = mode === "edit" ? initialValues?.id : undefined;
    const allCategories = categoryAllowlist
        ? EXPENSE_CATEGORIES.filter(c => categoryAllowlist.includes(c.id))
        : EXPENSE_CATEGORIES;
    const usedCategorySet = useUsedCategoryValues("expenses", householdId);
    // Always include the currently-selected value in "used" so editing an
    // already-set row doesn't push its category into the More group.
    const usedCategories = allCategories.filter(c => usedCategorySet.has(c.id) || c.id === form.category);
    const moreCategories = allCategories.filter(c => !usedCategorySet.has(c.id) && c.id !== form.category);
    const selectedCategory = allCategories.find(c => c.id === form.category);
    const SelectedIcon = selectedCategory?.icon;
    const canSave = !!form.category && !!form.name?.trim() && parseFloat(String(form.default_amount ?? 0)) >= 0;

    const renderCategoryItem = (c: typeof allCategories[number]) => {
        const Icon = c.icon;
        return (
            <SelectItem key={c.id} value={c.id}>
                <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{c.label}</span>
                </div>
            </SelectItem>
        );
    };

    const handleSave = async () => {
        if (!canSave || !user) return;
        setSaving(true);
        try {
            const numericAmount = parseFloat(String(form.default_amount ?? 0));
            const baseData: any = {
                household_id: householdId,
                category: form.category,
                name: form.name?.trim() ?? "",
                default_amount: numericAmount,
                is_credit: !!form.is_credit,
                subject_id: form.subject_id ?? null,
                created_by: user.id,
                is_active: true,
            };
            const encrypted = await encryptExpense(baseData);

            let expenseId = editingId;
            if (editingId) {
                const { error } = await supabase
                    .from("expenses")
                    .update({ ...encrypted, category: form.category })
                    .eq("id", editingId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from("expenses")
                    .insert({ ...encrypted, category: form.category })
                    .select("id")
                    .single();
                if (error || !data) throw error || new Error("Insert failed");
                expenseId = data.id;

                const month = getCurrentFinancialMonth(financialMonthStart);
                const { start, end } = getFinancialMonthRange(month, financialMonthStart);
                const monthlyEncrypted = await encryptMonthly({
                    household_id: householdId,
                    expense_id: expenseId,
                    month,
                    month_start: format(start, "yyyy-MM-dd"),
                    month_end: format(end, "yyyy-MM-dd"),
                    budget_amount: numericAmount,
                    created_by: user.id,
                });
                await supabase
                    .from("monthly_expenses")
                    .upsert(monthlyEncrypted, { onConflict: "expense_id,month", ignoreDuplicates: true });
            }

            toast.success(editingId ? "Expense updated" : "Expense added");
            onSuccess?.();

            if (mode === "add" && createAnother) {
                setForm(blankForm);
            } else {
                onOpenChange(false);
            }
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to save expense");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editingId) return;
        setDeleting(true);
        try {
            const { error } = await supabase.from("expenses").delete().eq("id", editingId);
            if (error) throw error;
            toast.success("Expense deleted");
            onSuccess?.();
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err.message || "Failed to delete");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{mode === "edit" ? "Edit expense" : "Add expense"}</DialogTitle>
                    <DialogDescription>
                        Recurring bill or budget category. Rent, utilities, groceries, etc.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                            value={form.category}
                            onValueChange={(v) => setForm({ ...form, category: v })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a category">
                                    {selectedCategory && (
                                        <div className="flex items-center gap-2">
                                            {SelectedIcon && <SelectedIcon className="h-4 w-4" />}
                                            <span>{selectedCategory.label}</span>
                                        </div>
                                    )}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {usedCategories.length > 0 && (
                                    <SelectGroup>
                                        <SelectLabel>Used in this household</SelectLabel>
                                        {usedCategories.map(renderCategoryItem)}
                                    </SelectGroup>
                                )}
                                {moreCategories.length > 0 && (
                                    <SelectGroup>
                                        <SelectLabel>{usedCategories.length > 0 ? "More categories" : "All categories"}</SelectLabel>
                                        {moreCategories.map(renderCategoryItem)}
                                    </SelectGroup>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Provider / source</Label>
                        <Input
                            value={form.name ?? ""}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Telia, Vattenfall, etc."
                        />
                    </div>

                    <SubjectPicker
                        householdId={householdId}
                        value={form.subject_id}
                        onChange={(id) => setForm({ ...form, subject_id: id })}
                    />

                    <div className="space-y-2">
                        <Label>Monthly amount (kr)</Label>
                        <Input
                            type="number"
                            inputMode="numeric"
                            value={String(form.default_amount ?? "")}
                            onChange={(e) => setForm({ ...form, default_amount: e.target.value })}
                            placeholder="0"
                        />
                    </div>

                    {showCreditToggle && (
                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-line-2">
                            <div className="flex items-center gap-3">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <Label className="text-sm font-medium cursor-pointer">Credit-card tracked</Label>
                                    <p className="text-xs text-muted-foreground">Actuals come from PDF invoice imports.</p>
                                </div>
                            </div>
                            <Switch
                                checked={!!form.is_credit}
                                onCheckedChange={(checked) => setForm({ ...form, is_credit: checked })}
                            />
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        {mode === "edit" && editingId ? (
                            <Button variant="destructive" onClick={handleDelete} disabled={saving || deleting}>
                                {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Delete
                            </Button>
                        ) : (
                            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                                <Checkbox checked={createAnother} onCheckedChange={(v) => setCreateAnother(v === true)} />
                                Create another
                            </label>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={!canSave || saving}>
                            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : (mode === "edit" ? "Save" : "Add")}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
