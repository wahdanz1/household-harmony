import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryptedFields, insuranceFields } from "@/hooks/useEncryptedFields";
import { useUsedCategoryValues } from "@/hooks/useUsedCategoryValues";
import { SubjectPicker } from "@/components/shared/SubjectPicker";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { FormField, FormRow } from "@/components/shared/FormField";
import { useEntityForm } from "@/hooks/useEntityForm";

const insuranceTypes = [
    { value: "home", label: "Home Insurance" },
    { value: "car", label: "Car Insurance" },
    { value: "health", label: "Health Insurance" },
    { value: "child", label: "Child Insurance" },
    { value: "life", label: "Life Insurance" },
    { value: "pet", label: "Pet Insurance" },
    { value: "travel", label: "Travel Insurance" },
    { value: "liability", label: "Liability Insurance" },
    { value: "other", label: "Other" },
];

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

interface InitialValues {
    id?: string;
    name?: string;
    provider?: string | null;
    category?: string;
    total_amount?: number | string;
    payment_frequency?: string;
    invoice_month?: number | string | null;
    notes?: string | null;
    is_active?: boolean;
    is_shared?: boolean;
    co_parent_id?: string | null;
    share_percentage?: number | string;
    subject_id?: string | null;
}

interface InsuranceFormProps {
    householdId: string;
    onSuccess: () => void;
    onCancel: () => void;
    editingId?: string;
    initialValues?: InitialValues;
    onDelete?: () => void;
    showCreateAnother?: boolean;
}

const blank = (): InitialValues => ({
    name: "",
    provider: "",
    category: "home",
    total_amount: "",
    payment_frequency: "yearly",
    invoice_month: "",
    notes: "",
    is_active: true,
    is_shared: false,
    co_parent_id: "",
    share_percentage: "50",
    subject_id: null,
});

export const InsuranceForm = ({
    householdId, onSuccess, onCancel,
    editingId, initialValues, onDelete, showCreateAnother = true,
}: InsuranceFormProps) => {
    const { user } = useAuth();
    const { encryptRecord } = useEncryptedFields(insuranceFields);
    const [coParents, setCoParents] = useState<any[]>([]);
    const [pristine, setPristine] = useState<InitialValues>(() => ({ ...blank(), ...initialValues }));
    const [formData, setFormData] = useState<InitialValues>(pristine);

    useEffect(() => {
        const fetchCoParents = async () => {
            const { data } = await supabase.from("co_parents").select("*").eq("household_id", householdId);
            setCoParents(data || []);
        };
        fetchCoParents();
    }, [householdId]);

    useEffect(() => {
        const sanitized = { ...blank(), ...initialValues };
        if (sanitized.name === "NaN" || typeof sanitized.name !== "string") sanitized.name = "";
        setPristine(sanitized);
        setFormData(sanitized);
    }, [initialValues, editingId]);

    const isEditing = !!editingId;
    const isRecurringNonMonthly = formData.payment_frequency && formData.payment_frequency !== "monthly";
    const canSave = !!String(formData.total_amount ?? "").trim()
        && (parseFloat(String(formData.total_amount)) || 0) > 0;

    const usedCategorySet = useUsedCategoryValues("insurances", householdId);
    const usedTypes = insuranceTypes.filter(t => usedCategorySet.has(t.value) || t.value === formData.category);
    const moreTypes = insuranceTypes.filter(t => !usedCategorySet.has(t.value) && t.value !== formData.category);

    const form = useEntityForm({
        entityName: "Insurance",
        isEdit: isEditing,
        save: async () => {
            if (!user) throw new Error("Not authenticated");
            const baseData = {
                household_id: householdId,
                name: formData.name?.trim() ?? "",
                provider: formData.provider || null,
                category: formData.category ?? "home",
                total_amount: parseFloat(String(formData.total_amount ?? 0)),
                payment_frequency: formData.payment_frequency ?? "yearly",
                invoice_month: formData.invoice_month && String(formData.invoice_month) !== "0" && String(formData.invoice_month) !== ""
                    ? parseInt(String(formData.invoice_month))
                    : null,
                notes: formData.notes || null,
                is_active: formData.is_active ?? true,
                is_shared: !!formData.is_shared,
                co_parent_id: formData.is_shared ? (formData.co_parent_id || null) : null,
                share_percentage: formData.is_shared ? parseFloat(String(formData.share_percentage ?? 50)) : 50,
                subject_id: formData.subject_id ?? null,
                created_by: user.id,
            };
            const data = await encryptRecord(baseData);
            if (editingId) {
                const { error } = await supabase.from("insurances").update(data as any).eq("id", editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("insurances").insert(data as any);
                if (error) throw error;
            }
        },
        remove: editingId ? async () => {
            const { error } = await supabase.from("insurances").delete().eq("id", editingId);
            if (error) throw error;
        } : undefined,
        onSaved: onSuccess,
        onDeleted: onDelete,
        resetForm: () => { const b = blank(); setPristine(b); setFormData(b); },
        formValues: formData,
        pristineValues: pristine,
    });

    return (
        <div className="space-y-3">
            <FormRow>
                <FormField label="Type">
                    <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {usedTypes.length > 0 && (
                                <SelectGroup>
                                    <SelectLabel>Used in this household</SelectLabel>
                                    {usedTypes.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectGroup>
                            )}
                            {moreTypes.length > 0 && (
                                <SelectGroup>
                                    <SelectLabel>{usedTypes.length > 0 ? "More types" : "All types"}</SelectLabel>
                                    {moreTypes.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectGroup>
                            )}
                        </SelectContent>
                    </Select>
                </FormField>
                <FormField label="Provider">
                    <Input
                        value={formData.provider ?? ""}
                        onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                        placeholder="Länsförsäkringar, If, Folksam…"
                    />
                </FormField>
            </FormRow>

            <FormRow>
                <FormField label="Total amount">
                    <Input
                        type="number"
                        value={String(formData.total_amount ?? "")}
                        onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                        placeholder="0"
                    />
                </FormField>
                <FormField label="Payment frequency">
                    <Select
                        value={formData.payment_frequency}
                        onValueChange={(v) => setFormData({ ...formData, payment_frequency: v })}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="yearly">Yearly</SelectItem>
                            <SelectItem value="semi_annually">Semi-annually (6 months)</SelectItem>
                            <SelectItem value="quarterly">Quarterly (3 months)</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                    </Select>
                </FormField>
            </FormRow>

            <FormRow>
                {isRecurringNonMonthly && (
                    <FormField label="Invoice month" optional>
                        <Select
                            value={String(formData.invoice_month ?? "")}
                            onValueChange={(v) => setFormData({ ...formData, invoice_month: v })}
                        >
                            <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">Not set</SelectItem>
                                {monthNames.map((month, index) => (
                                    <SelectItem key={index + 1} value={(index + 1).toString()}>
                                        {month}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>
                )}
                <SubjectPicker
                    householdId={householdId}
                    value={formData.subject_id}
                    onChange={(id) => setFormData({ ...formData, subject_id: id })}
                    label="Covers"
                />
            </FormRow>

            <FormField label="Name" optional optionalNote="optional, overrides display">
                <Input
                    value={formData.name ?? ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Defaults to 'Provider — Type'"
                />
            </FormField>

            <FormField label="Notes">
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

            {coParents.length > 0 && (
                <div className="space-y-4 border-t border-border pt-4">
                    <div className="flex items-center space-x-2">
                        <Switch
                            checked={!!formData.is_shared}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_shared: checked })}
                        />
                        <Label>Shared with co-parent</Label>
                    </div>

                    {formData.is_shared && (
                        <>
                            <div className="space-y-2">
                                <Label>Co-parent</Label>
                                <Select
                                    value={formData.co_parent_id ?? ""}
                                    onValueChange={(v) => setFormData({ ...formData, co_parent_id: v })}
                                >
                                    <SelectTrigger><SelectValue placeholder="Select co-parent" /></SelectTrigger>
                                    <SelectContent>
                                        {coParents.map((cp) => (
                                            <SelectItem key={cp.id} value={cp.id}>{cp.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Your share (%)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={String(formData.share_percentage ?? "50")}
                                    onChange={(e) => setFormData({ ...formData, share_percentage: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    You pay {formData.share_percentage}%, they pay {100 - parseFloat(String(formData.share_percentage || "0"))}%
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}

            <FormDialogFooter
                isEdit={isEditing}
                saving={form.saving}
                deleting={form.deleting}
                canSave={canSave && form.isDirty}
                onCancel={onCancel}
                onSave={form.handleSave}
                onRequestDelete={onDelete ? form.requestDelete : undefined}
                showCreateAnother={showCreateAnother}
                createAnother={form.createAnother}
                onCreateAnotherChange={form.setCreateAnother}
            />

            <ConfirmDialog
                open={form.confirmDeleteOpen}
                onOpenChange={form.setConfirmDeleteOpen}
                title="Delete this insurance?"
                description="This can't be undone."
                busy={form.deleting}
                onConfirm={form.handleDelete}
            />
        </div>
    );
};
