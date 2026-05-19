import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
    useEncryptedFields,
    expenseFields,
    monthlyExpenseFields,
} from "@/hooks/useEncryptedFields";
import { EXPENSE_CATEGORIES } from "@/constants/expenseCategories";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
import { useUsedCategoryValues } from "@/hooks/useUsedCategoryValues";
import { AttributionPicker, type AttributionValue } from "@/components/shared/AttributionPicker";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { FormField } from "@/components/shared/FormField";
import { MarkPaidSection } from "@/components/shared/MarkPaidSection";
import { useEntityForm } from "@/hooks/useEntityForm";

interface InitialValues {
    id?: string;
    category?: string;
    name?: string;
    budget?: number | string;
    is_credit?: boolean;
    attribution?: AttributionValue;
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
    budget: "0",
    is_credit: false,
    attribution: null,
};

export const ExpenseFormDialog = ({
    open, onOpenChange, mode, householdId, financialMonthStart,
    initialValues, categoryAllowlist, showCreditToggle = true, onSuccess,
}: ExpenseFormDialogProps) => {
    const { user } = useAuth();
    const [pristine, setPristine] = useState<InitialValues>(() => ({ ...blankForm, ...initialValues }));
    const [form, setForm] = useState<InitialValues>(pristine);

    const { encryptRecord: encryptExpense } = useEncryptedFields(expenseFields);
    const { encryptRecord: encryptMonthly } = useEncryptedFields(monthlyExpenseFields);

    useEffect(() => {
        if (!open) return;
        const next = { ...blankForm, ...initialValues };
        setPristine(next);
        setForm(next);
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
    const canSave = !!form.category && !!form.name?.trim() && parseFloat(String(form.budget ?? 0)) >= 0;

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

    const entityForm = useEntityForm({
        entityName: "Expense",
        isEdit: mode === "edit",
        save: async () => {
            if (!user) throw new Error("Not authenticated");
            const numericAmount = parseFloat(String(form.budget ?? 0));
            const baseData: any = {
                household_id: householdId,
                category: form.category,
                name: form.name?.trim() ?? "",
                budget: numericAmount,
                is_credit: !!form.is_credit,
                subject_id: form.attribution?.kind === "subject" ? form.attribution.id : null,
                member_id: form.attribution?.kind === "member" ? form.attribution.id : null,
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
                    budget_snapshot: numericAmount,
                    created_by: user.id,
                });
                await supabase
                    .from("monthly_expenses")
                    .upsert(monthlyEncrypted, { onConflict: "expense_id,month", ignoreDuplicates: true });
            }
        },
        remove: editingId ? async () => {
            const { error } = await supabase.from("expenses").delete().eq("id", editingId);
            if (error) throw error;
        } : undefined,
        onSaved: () => {
            onSuccess?.();
            if (mode === "edit" || !entityForm.createAnother) onOpenChange(false);
        },
        onDeleted: () => {
            onSuccess?.();
            onOpenChange(false);
        },
        resetForm: () => { setPristine(blankForm); setForm(blankForm); },
        formValues: form,
        pristineValues: pristine,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{mode === "edit" ? "Edit expense" : "Add expense"}</DialogTitle>
                    <DialogDescription>
                        Recurring bill or budget category. Rent, utilities, groceries, etc.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <FormField label="Category">
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
                    </FormField>

                    <FormField label="Provider / source">
                        <Input
                            value={form.name ?? ""}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Telia, Vattenfall, etc."
                        />
                    </FormField>

                    <AttributionPicker
                        householdId={householdId}
                        value={form.attribution ?? null}
                        onChange={(attribution) => setForm({ ...form, attribution })}
                    />

                    <FormField
                        label="Monthly amount (kr)"
                        hint={mode === "edit" && String(form.budget ?? "") !== String(pristine.budget ?? "")
                            ? `Applies to ${format(getFinancialMonthRange(getCurrentFinancialMonth(financialMonthStart), financialMonthStart).end, "MMMM yyyy")} and onwards.`
                            : undefined}
                    >
                        <Input
                            type="number"
                            inputMode="numeric"
                            value={String(form.budget ?? "")}
                            onChange={(e) => setForm({ ...form, budget: e.target.value })}
                            placeholder="0"
                        />
                    </FormField>

                    {mode === "edit" && editingId && (
                        <MarkPaidSection
                            sourceId={editingId}
                            householdId={householdId}
                            table="monthly_expenses"
                            fkColumn="expense_id"
                            currency="SEK"
                            financialMonthStart={financialMonthStart}
                        />
                    )}

                    {showCreditToggle && (
                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-line-2">
                            <div className="flex items-center gap-3">
                                <CreditCard className="h-4 w-4 text-muted" />
                                <div>
                                    <Label className="text-sm font-medium cursor-pointer">Credit-card tracked</Label>
                                    <p className="text-xs text-muted">Actuals come from PDF invoice imports.</p>
                                </div>
                            </div>
                            <Switch
                                checked={!!form.is_credit}
                                onCheckedChange={(checked) => setForm({ ...form, is_credit: checked })}
                            />
                        </div>
                    )}
                </div>

                <FormDialogFooter
                    isEdit={mode === "edit"}
                    saving={entityForm.saving}
                    deleting={entityForm.deleting}
                    canSave={canSave && entityForm.isDirty}
                    onSave={entityForm.handleSave}
                    onRequestDelete={editingId ? entityForm.requestDelete : undefined}
                    createAnother={entityForm.createAnother}
                    onCreateAnotherChange={entityForm.setCreateAnother}
                />
            </DialogContent>
            <ConfirmDialog
                open={entityForm.confirmDeleteOpen}
                onOpenChange={entityForm.setConfirmDeleteOpen}
                title="Delete this expense?"
                description="This can't be undone."
                busy={entityForm.deleting}
                onConfirm={entityForm.handleDelete}
            />
        </Dialog>
    );
};
