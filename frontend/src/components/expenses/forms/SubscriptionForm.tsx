import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryptedFields, subscriptionFields } from "@/hooks/useEncryptedFields";
import { useUsedCategoryValues } from "@/hooks/useUsedCategoryValues";
import { SubjectPicker } from "@/components/shared/SubjectPicker";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { FormField, FormRow } from "@/components/shared/FormField";
import { useEntityForm } from "@/hooks/useEntityForm";
import { subscriptionCategories } from "@/constants/subscriptionCategories";

interface InitialValues {
    id?: string;
    name?: string;
    service?: string;
    budget?: number | string;
    billing_cycle?: string;
    category?: string;
    notes?: string;
    is_active?: boolean;
    billing_day?: number;
    billing_month?: number;
    subject_id?: string | null;
}

interface SubscriptionFormProps {
    householdId: string;
    onSuccess: () => void;
    onCancel: () => void;
    onClose?: () => void;
    /** Pass to enable edit mode. */
    editingId?: string;
    initialValues?: InitialValues;
    onDelete?: () => void;
    /** Show the Create-another checkbox in add mode. */
    showCreateAnother?: boolean;
}

const blank = (): InitialValues => ({
    name: "",
    service: "",
    budget: "",
    billing_cycle: "monthly",
    category: "other",
    notes: "",
    is_active: true,
    subject_id: null,
});

export const SubscriptionForm = ({
    householdId, onSuccess, onCancel, onClose,
    editingId, initialValues, onDelete, showCreateAnother = true,
}: SubscriptionFormProps) => {
    const { user } = useAuth();
    const { encryptRecord } = useEncryptedFields(subscriptionFields);
    const [pristine, setPristine] = useState<InitialValues>(() => ({ ...blank(), ...initialValues }));
    const [formData, setFormData] = useState<InitialValues>(pristine);

    useEffect(() => {
        const next = { ...blank(), ...initialValues };
        setPristine(next);
        setFormData(next);
    }, [initialValues, editingId]);

    const isEditing = !!editingId;
    const canSave = !!formData.service?.trim() && !!String(formData.budget ?? "").trim();

    const usedCategorySet = useUsedCategoryValues("subscriptions", householdId);
    const usedCats = subscriptionCategories.filter(c => usedCategorySet.has(c.value) || c.value === formData.category);
    const moreCats = subscriptionCategories.filter(c => !usedCategorySet.has(c.value) && c.value !== formData.category);

    const form = useEntityForm({
        entityName: "Subscription",
        isEdit: isEditing,
        save: async () => {
            if (!user) throw new Error("Not authenticated");
            const baseData = {
                household_id: householdId,
                service: formData.service?.trim() ?? "",
                name: formData.name?.trim() || null,
                budget: parseFloat(String(formData.budget ?? 0)),
                billing_cycle: formData.billing_cycle ?? "monthly",
                category: formData.category ?? "other",
                notes: formData.notes ?? "",
                is_active: formData.is_active ?? true,
                created_by: user.id,
                billing_day: formData.billing_cycle !== "monthly" ? formData.billing_day ?? null : null,
                billing_month: formData.billing_cycle !== "monthly" ? formData.billing_month ?? null : null,
                subject_id: formData.subject_id ?? null,
            };
            const data = await encryptRecord(baseData);
            if (editingId) {
                const { error } = await supabase.from("subscriptions").update(data).eq("id", editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("subscriptions").insert(data);
                if (error) throw error;
            }
        },
        remove: editingId ? async () => {
            const { error } = await supabase.from("subscriptions").delete().eq("id", editingId);
            if (error) throw error;
        } : undefined,
        onSaved: onSuccess,
        onClose,
        onDeleted: onDelete,
        resetForm: () => { const b = blank(); setPristine(b); setFormData(b); },
        formValues: formData,
        pristineValues: pristine,
    });

    return (
        <div className="space-y-3">
            <FormRow>
                <FormField label="Service">
                    <Input
                        value={formData.service ?? ""}
                        onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                        placeholder="Netflix, Claude Pro, Spotify Family"
                    />
                </FormField>
                <FormField label="Category">
                    <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {usedCats.length > 0 && (
                                <SelectGroup>
                                    <SelectLabel>Used in this household</SelectLabel>
                                    {usedCats.map((cat) => {
                                        const Icon = cat.icon;
                                        return (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                <div className="flex items-center gap-2">
                                                    {Icon && <Icon className="h-4 w-4" />}
                                                    <span>{cat.label}</span>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectGroup>
                            )}
                            {moreCats.length > 0 && (
                                <SelectGroup>
                                    <SelectLabel>{usedCats.length > 0 ? "More categories" : "All categories"}</SelectLabel>
                                    {moreCats.map((cat) => {
                                        const Icon = cat.icon;
                                        return (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                <div className="flex items-center gap-2">
                                                    {Icon && <Icon className="h-4 w-4" />}
                                                    <span>{cat.label}</span>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectGroup>
                            )}
                        </SelectContent>
                    </Select>
                </FormField>
            </FormRow>

            <FormRow>
                <FormField label="Amount">
                    <Input
                        type="number"
                        value={String(formData.budget ?? "")}
                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                        placeholder="0"
                    />
                </FormField>
                <FormField label="Billing cycle">
                    <Select value={formData.billing_cycle} onValueChange={(v) => setFormData({ ...formData, billing_cycle: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                    </Select>
                </FormField>
            </FormRow>

            {(formData.billing_cycle === "yearly" || formData.billing_cycle === "quarterly") && (
                <FormRow>
                    <FormField label="Billing month">
                        <Select
                            value={formData.billing_month?.toString()}
                            onValueChange={(v) => setFormData({ ...formData, billing_month: parseInt(v) })}
                        >
                            <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                    <SelectItem key={m} value={m.toString()}>
                                        {format(new Date(2024, m - 1, 1), "MMMM")}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>
                    <FormField label="Billing day">
                        <Input
                            type="number"
                            min={1}
                            max={31}
                            value={formData.billing_day || ""}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val >= 1 && val <= 31) {
                                    setFormData({ ...formData, billing_day: val });
                                }
                            }}
                            placeholder="1–31"
                        />
                    </FormField>
                </FormRow>
            )}

            <SubjectPicker
                householdId={householdId}
                value={formData.subject_id}
                onChange={(id) => setFormData({ ...formData, subject_id: id })}
            />

            <FormField label="Name" optional optionalNote="optional, overrides display">
                <Input
                    value={formData.name ?? ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Defaults to 'Service'"
                />
            </FormField>

            <FormField label="Notes" optional>
                <Textarea
                    rows={2}
                    value={formData.notes ?? ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional notes"
                />
            </FormField>

            <div className="flex items-center space-x-2">
                <Switch
                    checked={!!formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
            </div>

            <FormDialogFooter
                isEdit={isEditing}
                saving={form.saving}
                deleting={form.deleting}
                canSave={canSave && form.isDirty}
                onSave={form.handleSave}
                onRequestDelete={onDelete ? form.requestDelete : undefined}
                showCreateAnother={showCreateAnother}
                createAnother={form.createAnother}
                onCreateAnotherChange={form.setCreateAnother}
            />

            <ConfirmDialog
                open={form.confirmDeleteOpen}
                onOpenChange={form.setConfirmDeleteOpen}
                title="Delete this subscription?"
                description="This can't be undone."
                busy={form.deleting}
                onConfirm={form.handleDelete}
            />
        </div>
    );
};
