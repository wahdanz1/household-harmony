import { useEffect, useState } from "react";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye } from "lucide-react";
import { useEncryption, spaceScope } from "@/contexts/EncryptionContext";
import { useCoParents } from "@/hooks/useCoParents";
import { publishCostClaim, withdrawCostClaim, withdrawFromOtherSpaces } from "@/services/coparentClaims";

interface InitialValues {
    description?: string;
    amount?: number | string;
    category?: string;
    notes?: string;
    attribution?: AttributionValue;
    is_shared?: boolean;
    co_parent_id?: string | null;
    share_percentage?: number | string | null;
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
    is_shared: init?.is_shared ?? false,
    co_parent_id: init?.co_parent_id ?? "",
    share_percentage: init?.share_percentage != null ? String(init.share_percentage) : "50",
});

export const TemporaryExpenseFormDialog = ({
    open, onOpenChange, householdId, financialMonthStart, editingId, initialValues, onSuccess,
}: TemporaryExpenseFormDialogProps) => {
    const { user } = useAuth();
    const { encryptRecord } = useEncryptedFields(monthlyExpenseFields);
    const { encryptFor } = useEncryption();
    const { coParents } = useCoParents(householdId, user?.id);
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
    const selectedCoParent = coParents.find(cp => cp.id === formData.co_parent_id);
    const publishesToCoParent = !!formData.is_shared
        && !!selectedCoParent?.spaceId
        && !!selectedCoParent?.linkedUserId;

    const entityForm = useEntityForm({
        entityName: "One-time expense",
        isEdit,
        save: async () => {
            if (!user) throw new Error("Not authenticated");
            const subject_id = formData.attribution?.kind === "subject" ? formData.attribution.id : null;
            const member_id = formData.attribution?.kind === "member" ? formData.attribution.id : null;
            const amount = parseFloat(formData.amount);
            const sharePercentage = formData.is_shared
                ? parseFloat(String(formData.share_percentage ?? 50)) || 50
                : null;
            const sharing = {
                is_shared: !!formData.is_shared,
                co_parent_id: formData.is_shared ? (formData.co_parent_id || null) : null,
                share_percentage: sharePercentage,
            };

            const publish = async (rowId: string) => {
                const spaceId = publishesToCoParent ? (selectedCoParent?.spaceId as string) : null;
                if (spaceId && user) {
                    await publishCostClaim({
                        spaceId,
                        householdId,
                        userId: user.id,
                        sourceKind: "expense",
                        sourceId: rowId,
                        label: formData.description.trim(),
                        subject: null,
                        amount,
                        sharePercentage: sharePercentage ?? 50,
                        billingCycle: "one_off",
                        encrypt: (plaintext) => encryptFor(spaceScope(spaceId), plaintext),
                    });
                }
                if (user) {
                    await withdrawFromOtherSpaces({
                        keepSpaceId: spaceId,
                        userId: user.id,
                        sourceKind: "expense",
                        sourceId: rowId,
                    });
                }
            };
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
                        ...sharing,
                    } as any)
                    .eq("id", editingId);
                if (error) throw error;
                await publish(editingId);
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
                ...sharing,
            };
            const data = await encryptRecord(baseData);
            const { data: inserted, error } = await supabase
                .from("monthly_expenses").insert(data as any).select("id").single();
            if (error) throw error;
            if (inserted?.id) await publish(inserted.id);
        },
        remove: editingId ? async () => {
            // Withdraw first: deleting the row leaves the claim pointing at
            // nothing, and the co-parent would keep seeing a cost that is gone.
            if (selectedCoParent?.spaceId) {
                await withdrawCostClaim({
                    spaceId: selectedCoParent.spaceId,
                    sourceKind: "expense",
                    sourceId: editingId,
                });
            }
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

                    {coParents.length > 0 && (
                        <div className="space-y-4 border-t border-line pt-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Split with a co-parent</Label>
                                    <p className="text-sm text-muted">For one-off costs like clothes or activities.</p>
                                </div>
                                <Switch
                                    checked={!!formData.is_shared}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_shared: checked })}
                                />
                            </div>

                            {formData.is_shared && (
                                <>
                                    <FormField label="Co-parent">
                                        <Select
                                            value={formData.co_parent_id || ""}
                                            onValueChange={(v) => setFormData({ ...formData, co_parent_id: v })}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select co-parent" /></SelectTrigger>
                                            <SelectContent>
                                                {coParents.map(cp => (
                                                    <SelectItem key={cp.id} value={cp.id}>
                                                        {cp.name}{cp.linkedUserId ? " · has an account" : ""}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormField>

                                    <FormField label="Your share (%)">
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={String(formData.share_percentage ?? "50")}
                                            onChange={(e) => setFormData({ ...formData, share_percentage: e.target.value })}
                                        />
                                    </FormField>

                                    {publishesToCoParent ? (
                                        <p className="text-sm text-accent-dk flex items-start gap-1.5">
                                            <Eye className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                            <span>
                                                {selectedCoParent?.name} will see this cost, the full amount and the split. Nothing else from your household.
                                            </span>
                                        </p>
                                    ) : (
                                        <p className="text-sm text-muted">
                                            Only tracked on your side.{selectedCoParent?.name ? ` ${selectedCoParent.name} has no account, so nothing is shared.` : ""}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    )}
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
