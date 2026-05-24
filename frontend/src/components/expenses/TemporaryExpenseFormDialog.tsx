import { useEffect, useState } from "react";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryptedFields, monthlyExpenseFields } from "@/hooks/useEncryptedFields";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
import { format } from "date-fns";
import { AttributionPicker, type AttributionValue } from "@/components/shared/AttributionPicker";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { FormField, FormRow } from "@/components/shared/FormField";
import { useEntityForm } from "@/hooks/useEntityForm";
import { oneOffExpenseCategories } from "@/constants/oneOffExpenseCategories";

interface InitialValues {
    description?: string;
    amount?: number | string;
    category?: string;
    notes?: string;
    attribution?: AttributionValue;
}

interface TemporaryExpenseFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    householdId: string;
    financialMonthStart: number;
    /** Pass the monthly_expenses row id to edit an existing one-off. */
    editingId?: string;
    initialValues?: InitialValues;
    onSuccess?: () => void;
}

const blank = (init?: InitialValues) => ({
    description: init?.description ?? "",
    amount: init?.amount != null ? String(init.amount) : "",
    category: init?.category ?? "",
    notes: init?.notes ?? "",
    attribution: init?.attribution ?? null as AttributionValue,
});

export const TemporaryExpenseFormDialog = ({
    open, onOpenChange, householdId, financialMonthStart, editingId, initialValues, onSuccess,
}: TemporaryExpenseFormDialogProps) => {
    const { user } = useAuth();
    const { encryptRecord } = useEncryptedFields(monthlyExpenseFields);
    const [pristine, setPristine] = useState(() => blank(initialValues));
    const [formData, setFormData] = useState(pristine);
    const isEdit = !!editingId;

    useEffect(() => {
        if (open) {
            const b = blank(initialValues);
            setPristine(b);
            setFormData(b);
        }
    }, [open, initialValues]);

    const canSave = !!formData.description.trim() && !!formData.amount.trim() && !!formData.category;

    const entityForm = useEntityForm({
        entityName: "One-time expense",
        isEdit,
        save: async () => {
            if (!user) throw new Error("Not authenticated");
            const subject_id = formData.attribution?.kind === "subject" ? formData.attribution.id : null;
            const member_id = formData.attribution?.kind === "member" ? formData.attribution.id : null;
            if (editingId) {
                const data = await encryptRecord({ budget_snapshot: parseFloat(formData.amount) });
                const { error } = await supabase
                    .from("monthly_expenses")
                    .update({
                        ...data,
                        one_time_name: formData.description.trim(),
                        one_time_category: formData.category,
                        notes: formData.notes || null,
                        subject_id,
                        member_id,
                    } as any)
                    .eq("id", editingId);
                if (error) throw error;
                return;
            }
            const month = getCurrentFinancialMonth(financialMonthStart);
            const { start, end } = getFinancialMonthRange(month, financialMonthStart);
            const baseData = {
                household_id: householdId,
                expense_id: null,
                month,
                month_start: format(start, "yyyy-MM-dd"),
                month_end: format(end, "yyyy-MM-dd"),
                one_time_name: formData.description.trim(),
                one_time_category: formData.category,
                budget_snapshot: parseFloat(formData.amount),
                notes: formData.notes || null,
                subject_id,
                member_id,
                created_by: user.id,
            };
            const data = await encryptRecord(baseData);
            const { error } = await supabase.from("monthly_expenses").insert(data as any);
            if (error) throw error;
        },
        remove: editingId ? async () => {
            const { error } = await supabase.from("monthly_expenses").delete().eq("id", editingId);
            if (error) throw error;
        } : undefined,
        onSaved: () => {
            onSuccess?.();
            if (isEdit || !entityForm.createAnother) onOpenChange(false);
        },
        onDeleted: () => {
            onSuccess?.();
            onOpenChange(false);
        },
        resetForm: () => { const b = blank(); setPristine(b); setFormData(b); },
        formValues: formData,
        pristineValues: pristine,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit one-off expense" : "Add one-off expense"}</DialogTitle>
                    <DialogDescription>
                        A one-time cost outside your regular budget — car repair, medical bill, gift, travel, etc.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <FormField label="Description">
                        <Input
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="e.g. Car tire replacement"
                        />
                    </FormField>

                    <FormRow>
                        <FormField label="Amount">
                            <Input
                                type="number"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                placeholder="0"
                            />
                        </FormField>
                        <FormField label="Category">
                            <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                                <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                                <SelectContent>
                                    {oneOffExpenseCategories.map((cat) => {
                                        const Icon = cat.icon;
                                        return (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                <div className="flex items-center gap-2">
                                                    <Icon className="h-4 w-4" />
                                                    <span>{cat.label}</span>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </FormField>
                    </FormRow>

                    <AttributionPicker
                        householdId={householdId}
                        value={formData.attribution ?? null}
                        onChange={(attribution) => setFormData({ ...formData, attribution })}
                    />

                    <FormField label="Notes" optional>
                        <Textarea
                            rows={2}
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Additional details"
                        />
                    </FormField>
                </div>

                <FormDialogFooter
                    isEdit={isEdit}
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
                title="Delete this one-off expense?"
                description="This can't be undone."
                busy={entityForm.deleting}
                onConfirm={entityForm.handleDelete}
            />
        </Dialog>
    );
};
