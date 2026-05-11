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
import { useEncryptedFields, monthlyExpenseFields } from "@/hooks/useEncryptedFields";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
import { format } from "date-fns";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { FormField, FormRow } from "@/components/shared/FormField";
import { useEntityForm } from "@/hooks/useEntityForm";

import { Wrench, Heart, Hammer, Gift, Plane, MoreHorizontal } from "lucide-react";

const temporaryCategories = [
    { value: "car_repair", label: "Car repair", icon: Wrench },
    { value: "medical", label: "Medical", icon: Heart },
    { value: "home_repair", label: "Home repair", icon: Hammer },
    { value: "gift", label: "Gift", icon: Gift },
    { value: "travel", label: "Travel", icon: Plane },
    { value: "other", label: "Other", icon: MoreHorizontal },
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
    const { encryptRecord } = useEncryptedFields(monthlyExpenseFields);
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
                amount: parseFloat(formData.amount),
                notes: formData.notes || null,
                created_by: user.id,
            };
            const data = await encryptRecord(baseData);
            const { error } = await supabase.from("monthly_expenses").insert(data as any);
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
                    <DialogTitle>Add one-off expense</DialogTitle>
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
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {temporaryCategories.map((cat) => {
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
                    onSave={entityForm.handleSave}
                    createAnother={entityForm.createAnother}
                    onCreateAnotherChange={entityForm.setCreateAnother}
                />
            </DialogContent>
        </Dialog>
    );
};
