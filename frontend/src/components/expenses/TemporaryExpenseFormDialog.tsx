import { useEffect, useState } from "react";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryptedFields, temporaryExpenseFields } from "@/hooks/useEncryptedFields";
import { getCurrentFinancialMonth } from "@/utils/dateUtils";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { FormField, FormRow } from "@/components/shared/FormField";
import { useEntityForm } from "@/hooks/useEntityForm";

const temporaryCategories = [
    { value: "car_repair", label: "Car repair" },
    { value: "medical", label: "Medical" },
    { value: "home_repair", label: "Home repair" },
    { value: "gift", label: "Gift" },
    { value: "travel", label: "Travel" },
    { value: "other", label: "Other" },
];

interface TemporaryExpenseFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    householdId: string;
    financialMonthStart: number;
    onSuccess?: () => void;
}

const blank = () => ({
    description: "",
    amount: "",
    category: "other",
    notes: "",
});

export const TemporaryExpenseFormDialog = ({
    open, onOpenChange, householdId, financialMonthStart, onSuccess,
}: TemporaryExpenseFormDialogProps) => {
    const { user } = useAuth();
    const { encryptRecord } = useEncryptedFields(temporaryExpenseFields);
    const [pristine, setPristine] = useState(blank());
    const [formData, setFormData] = useState(pristine);

    useEffect(() => {
        if (open) {
            const b = blank();
            setPristine(b);
            setFormData(b);
        }
    }, [open]);

    const canSave = !!formData.description.trim() && !!formData.amount.trim();

    const entityForm = useEntityForm({
        entityName: "One-time expense",
        isEdit: false,
        save: async () => {
            if (!user) throw new Error("Not authenticated");
            const baseData = {
                household_id: householdId,
                month: getCurrentFinancialMonth(financialMonthStart),
                description: formData.description.trim(),
                category: formData.category,
                amount: parseFloat(formData.amount),
                notes: formData.notes || null,
                created_by: user.id,
            };
            const data = await encryptRecord(baseData);
            const { error } = await supabase.from("temporary_expenses").insert(data);
            if (error) throw error;
        },
        onSaved: () => {
            onSuccess?.();
            if (!entityForm.createAnother) onOpenChange(false);
        },
        resetForm: () => { const b = blank(); setPristine(b); setFormData(b); },
        formValues: formData,
        pristineValues: pristine,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>One-time expense</DialogTitle>
                    <DialogDescription>
                        A single, unexpected cost — car repair, medical bill, gift, etc. Tracked just for this month.
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
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {temporaryCategories.map((cat) => (
                                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>
                    </FormRow>

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
                    isEdit={false}
                    saving={entityForm.saving}
                    canSave={canSave && entityForm.isDirty}
                    onCancel={() => onOpenChange(false)}
                    onSave={entityForm.handleSave}
                    createAnother={entityForm.createAnother}
                    onCreateAnotherChange={entityForm.setCreateAnother}
                />
            </DialogContent>
        </Dialog>
    );
};
