import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryptedFields, insuranceFields } from "@/hooks/useEncryptedFields";
import { Eye } from "lucide-react";
import { useEncryption, spaceScope } from "@/contexts/EncryptionContext";
import { publishCostClaim, withdrawFromOtherSpaces } from "@/services/coparentClaims";
import { useUsedCategoryValues } from "@/hooks/useUsedCategoryValues";
import { AttributionPicker, type AttributionValue } from "@/components/shared/AttributionPicker";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { FormField, FormRow } from "@/components/shared/FormField";
import { useEntityForm } from "@/hooks/useEntityForm";

import { insuranceTypes } from "@/constants/insuranceTypes";

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

interface InitialValues {
    id?: string;
    name?: string;
    provider?: string | null;
    category?: string;
    budget?: number | string;
    billing_cycle?: string;
    billing_month?: number | string | null;
    billing_day?: number | string | null;
    notes?: string | null;
    is_active?: boolean;
    is_shared?: boolean;
    co_parent_id?: string | null;
    share_percentage?: number | string;
    attribution?: AttributionValue;
}

interface InsuranceFormProps {
    householdId: string;
    onSuccess: () => void;
    onCancel: () => void;
    onClose?: () => void;
    editingId?: string;
    initialValues?: InitialValues;
    onDelete?: () => void;
    showCreateAnother?: boolean;
}

const blank = (): InitialValues => ({
    name: "",
    provider: "",
    category: "",
    budget: "",
    billing_cycle: "yearly",
    billing_month: "",
    billing_day: "",
    notes: "",
    is_active: true,
    is_shared: false,
    co_parent_id: "",
    share_percentage: "50",
    attribution: null,
});

export const InsuranceForm = ({
    householdId, onSuccess, onCancel, onClose,
    editingId, initialValues, onDelete, showCreateAnother = true,
}: InsuranceFormProps) => {
    const { user } = useAuth();
    const { encryptRecord } = useEncryptedFields(insuranceFields);
    const { encryptFor } = useEncryption();
    const [coParents, setCoParents] = useState<any[]>([]);
    const [subjectNames, setSubjectNames] = useState<Record<string, string>>({});
    const [pristine, setPristine] = useState<InitialValues>(() => ({ ...blank(), ...initialValues }));
    const [formData, setFormData] = useState<InitialValues>(pristine);

    useEffect(() => {
        const fetchCoParents = async () => {
            const { data } = await supabase
                .from("co_parents")
                .select("id, name, space_id, linked_user_id")
                .eq("household_id", householdId);
            setCoParents(data || []);
        };
        const fetchSubjects = async () => {
            const { data } = await supabase
                .from("subjects")
                .select("id, name")
                .eq("household_id", householdId);
            setSubjectNames(Object.fromEntries((data ?? []).map(s => [s.id, s.name])));
        };
        fetchCoParents();
        fetchSubjects();
    }, [householdId]);

    useEffect(() => {
        const sanitized = { ...blank(), ...initialValues };
        if (sanitized.name === "NaN" || typeof sanitized.name !== "string") sanitized.name = "";
        setPristine(sanitized);
        setFormData(sanitized);
    }, [initialValues, editingId]);

    const isEditing = !!editingId;
    const selectedCoParent = coParents.find(cp => cp.id === formData.co_parent_id);
    // A co-parent only "sees" anything once they hold the space key. Tagging an
    // unlinked label is bookkeeping; this is disclosure, and has to look like it.
    const publishesToCoParent = !!formData.is_shared
        && !!selectedCoParent?.space_id
        && !!selectedCoParent?.linked_user_id;
    const isRecurringNonMonthly = formData.billing_cycle && formData.billing_cycle !== "monthly";
    const canSave = !!formData.category
        && !!String(formData.budget ?? "").trim()
        && (parseFloat(String(formData.budget)) || 0) > 0;

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
                category: formData.category,
                budget: parseFloat(String(formData.budget ?? 0)),
                billing_cycle: formData.billing_cycle ?? "yearly",
                billing_month: formData.billing_month && String(formData.billing_month) !== "0" && String(formData.billing_month) !== ""
                    ? parseInt(String(formData.billing_month))
                    : null,
                billing_day: formData.billing_day && String(formData.billing_day) !== "0" && String(formData.billing_day) !== ""
                    ? parseInt(String(formData.billing_day))
                    : null,
                notes: formData.notes || null,
                is_active: formData.is_active ?? true,
                is_shared: !!formData.is_shared,
                co_parent_id: formData.is_shared ? (formData.co_parent_id || null) : null,
                share_percentage: formData.is_shared ? parseFloat(String(formData.share_percentage ?? 50)) : 50,
                subject_id: formData.attribution?.kind === "subject" ? formData.attribution.id : null,
                member_id: formData.attribution?.kind === "member" ? formData.attribution.id : null,
                created_by: user.id,
            };
            const data = await encryptRecord(baseData);
            let insuranceId = editingId;
            if (editingId) {
                const { error } = await supabase.from("insurances").update(data as any).eq("id", editingId);
                if (error) throw error;
            } else {
                const { data: inserted, error } = await supabase
                    .from("insurances").insert(data as any).select("id").single();
                if (error) throw error;
                insuranceId = inserted?.id ?? null;
            }

            if (!insuranceId) return;

            // Publishing is deliberately part of saving: the co-parent should
            // never be a step you can forget after changing an amount.
            const spaceId = publishesToCoParent ? selectedCoParent?.space_id as string : null;
            if (spaceId) {
                await publishCostClaim({
                    spaceId,
                    householdId,
                    userId: user.id,
                    sourceKind: "insurance",
                    sourceId: insuranceId,
                    label: baseData.name || "Insurance",
                    subject: baseData.subject_id ? subjectNames[baseData.subject_id] ?? null : null,
                    amount: baseData.budget,
                    sharePercentage: baseData.share_percentage,
                    billingCycle: baseData.billing_cycle,
                    encrypt: (plaintext) => encryptFor(spaceScope(spaceId), plaintext),
                });
            }
            // Covers un-sharing and re-pointing at a different co-parent, either
            // of which would otherwise leave the old one still seeing this.
            await withdrawFromOtherSpaces({
                keepSpaceId: spaceId,
                userId: user.id,
                sourceKind: "insurance",
                sourceId: insuranceId,
            });
        },
        remove: editingId ? async () => {
            const { error } = await supabase.from("insurances").delete().eq("id", editingId);
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
                <FormField label="Type">
                    <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                        <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                        <SelectContent>
                            {usedTypes.length > 0 && (
                                <SelectGroup>
                                    <SelectLabel>Used in this household</SelectLabel>
                                    {usedTypes.map((t) => {
                                        const Icon = t.icon;
                                        return (
                                            <SelectItem key={t.value} value={t.value}>
                                                <div className="flex items-center gap-2">
                                                    {Icon && <Icon className="h-4 w-4" />}
                                                    <span>{t.label}</span>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectGroup>
                            )}
                            {moreTypes.length > 0 && (
                                <SelectGroup>
                                    <SelectLabel>{usedTypes.length > 0 ? "More types" : "All types"}</SelectLabel>
                                    {moreTypes.map((t) => {
                                        const Icon = t.icon;
                                        return (
                                            <SelectItem key={t.value} value={t.value}>
                                                <div className="flex items-center gap-2">
                                                    {Icon && <Icon className="h-4 w-4" />}
                                                    <span>{t.label}</span>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
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
                        value={String(formData.budget ?? "")}
                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                        placeholder="0"
                    />
                </FormField>
                <FormField label="Billing cycle">
                    <Select
                        value={formData.billing_cycle}
                        onValueChange={(v) => setFormData({ ...formData, billing_cycle: v })}
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

            {isRecurringNonMonthly && (
                <>
                    <FormRow>
                        <FormField label="Billing month" optional>
                            <Select
                                value={String(formData.billing_month ?? "")}
                                onValueChange={(v) => setFormData({ ...formData, billing_month: v })}
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
                        <FormField label="Billing day" optional>
                            <Input
                                type="number"
                                min="1"
                                max="31"
                                value={String(formData.billing_day ?? "")}
                                onChange={(e) => setFormData({ ...formData, billing_day: e.target.value })}
                                placeholder="Day of month"
                            />
                        </FormField>
                    </FormRow>
                    <p className="text-xs text-muted -mt-1">
                        Set a billing date to get a heads-up when it's due.
                    </p>
                </>
            )}

            <AttributionPicker
                householdId={householdId}
                value={formData.attribution ?? null}
                onChange={(attribution) => setFormData({ ...formData, attribution })}
                label="Covers"
            />

            <FormField label="Name" optional optionalNote="optional, overrides display">
                <Input
                    value={formData.name ?? ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Defaults to 'Provider — Type'"
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

            {coParents.length > 0 && (
                <div className="space-y-4 border-t border-line pt-4">
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
                                            <SelectItem key={cp.id} value={cp.id}>
                                                {cp.name}{cp.linked_user_id ? " · has an account" : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {publishesToCoParent ? (
                                    <p className="text-sm text-accent-dk flex items-start gap-1.5">
                                        <Eye className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                        <span>
                                            {selectedCoParent?.name} will see this insurance — its name, the full amount and the split. Nothing else from your household.
                                        </span>
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted">
                                        Only tracked on your side. {selectedCoParent?.name ? `${selectedCoParent.name} has no account, so nothing is shared.` : ""}
                                    </p>
                                )}
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
                                <p className="text-xs text-muted">
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
