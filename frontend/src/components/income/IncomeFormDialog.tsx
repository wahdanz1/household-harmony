import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
    useEncryptedFields,
    incomeSourceFields,
    monthlyIncomeFields,
} from "@/hooks/useEncryptedFields";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
import { computeFromNet, TAX_TYPE_LABELS, type TaxType } from "@/utils/taxMath";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { FormField, FormRow } from "@/components/shared/FormField";
import { useEntityForm } from "@/hooks/useEntityForm";

import { Briefcase, TrendingUp, HandCoins, PiggyBank, MoreHorizontal } from "lucide-react";

const INCOME_CATEGORIES = [
    { value: "salary", label: "Salary", icon: Briefcase },
    { value: "business_income", label: "Business income", icon: PiggyBank },
    { value: "government_benefits", label: "Government benefits", icon: HandCoins },
    { value: "investment_income", label: "Investment income", icon: TrendingUp },
    { value: "other", label: "Other", icon: MoreHorizontal },
] as const;

type IncomeCategory = typeof INCOME_CATEGORIES[number]["value"];

interface InitialValues {
    id?: string;
    category?: IncomeCategory;
    name?: string;
    provider?: string;
    owner_id?: string;
    default_amount?: number | string;
    is_shared?: boolean;
    co_parent_id?: string | null;
    share_percentage?: number | string | null;
    tax_type?: TaxType | null;
    custom_tax_rate?: number | string | null;
    is_active?: boolean;
}

interface IncomeFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: "add" | "edit";
    householdId: string;
    members: Array<{ user_id: string; profiles?: { full_name?: string; email?: string } }>;
    coParents?: Array<{ id: string; name: string }>;
    financialMonthStart: number;
    initialValues?: InitialValues;
    onSuccess?: () => void;
}

const blankForm = (defaultOwnerId: string): InitialValues => ({
    category: "salary",
    name: "",
    provider: "",
    default_amount: "0",
    owner_id: defaultOwnerId,
    is_shared: false,
    co_parent_id: "",
    share_percentage: "50",
    tax_type: "no_tax",
    custom_tax_rate: "",
    is_active: true,
});

export const IncomeFormDialog = ({
    open, onOpenChange, mode, householdId, members, coParents = [],
    financialMonthStart, initialValues, onSuccess,
}: IncomeFormDialogProps) => {
    const { user } = useAuth();
    // Default to the current user, not whoever happens to be members[0].
    const defaultOwnerId = initialValues?.owner_id || user?.id || members[0]?.user_id || "";
    const [pristine, setPristine] = useState<InitialValues>(() => ({
        ...blankForm(defaultOwnerId),
        ...initialValues,
    }));
    const [form, setForm] = useState<InitialValues>(pristine);

    const { encryptRecord: encryptSource } = useEncryptedFields(incomeSourceFields);
    const { encryptRecord: encryptMonthly } = useEncryptedFields(monthlyIncomeFields);

    useEffect(() => {
        if (!open) return;
        const next = { ...blankForm(defaultOwnerId), ...initialValues };
        setPristine(next);
        setForm(next);
    }, [open, initialValues, defaultOwnerId]);

    const editingId = mode === "edit" ? initialValues?.id : undefined;
    const canSave = !!form.provider?.trim() && parseFloat(String(form.default_amount ?? 0)) >= 0 && !!form.owner_id;

    const entityForm = useEntityForm({
        entityName: "Income source",
        isEdit: mode === "edit",
        save: async () => {
            const numericAmount = parseFloat(String(form.default_amount ?? 0));
            const baseData = {
                household_id: householdId,
                category: form.category,
                provider: form.provider?.trim() ?? "",
                name: form.name?.trim() || null,
                default_amount: numericAmount,
                owner_id: form.owner_id ?? "",
                is_shared: !!form.is_shared,
                co_parent_id: form.is_shared ? (form.co_parent_id || null) : null,
                share_percentage: form.is_shared ? parseFloat(String(form.share_percentage ?? 50)) : null,
                tax_type: form.tax_type ?? "no_tax",
                custom_tax_rate: form.tax_type === "csn_variable"
                    ? parseFloat(String(form.custom_tax_rate ?? 0)) || 0
                    : null,
                is_active: form.is_active ?? true,
            };
            const encryptedSource = await encryptSource(baseData);

            let createdId = editingId;
            if (editingId) {
                const { error } = await supabase
                    .from("income_sources")
                    .update({ ...encryptedSource, category: form.category })
                    .eq("id", editingId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from("income_sources")
                    .insert({ ...encryptedSource, category: form.category })
                    .select("id")
                    .single();
                if (error || !data) throw error || new Error("Insert failed");
                createdId = data.id;

                const month = getCurrentFinancialMonth(financialMonthStart);
                const { start, end } = getFinancialMonthRange(month, financialMonthStart);
                const monthlyEncrypted = await encryptMonthly({
                    household_id: householdId,
                    income_source_id: createdId,
                    month,
                    month_start: format(start, "yyyy-MM-dd"),
                    month_end: format(end, "yyyy-MM-dd"),
                    budget_amount: numericAmount,
                    created_by: form.owner_id ?? "",
                });
                await supabase
                    .from("monthly_incomes")
                    .upsert(monthlyEncrypted, { onConflict: "income_source_id,month", ignoreDuplicates: true });
            }
        },
        remove: editingId ? async () => {
            const { error } = await supabase.from("income_sources").delete().eq("id", editingId);
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
        resetForm: () => { const b = blankForm(defaultOwnerId); setPristine(b); setForm(b); },
        formValues: form,
        pristineValues: pristine,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{mode === "edit" ? "Edit income source" : "Add income source"}</DialogTitle>
                    <DialogDescription>
                        Recurring monthly income — salary, CSN, government benefits, etc.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <FormRow>
                        <FormField label="Category">
                            <Select
                                value={form.category}
                                onValueChange={(v) => setForm({ ...form, category: v as IncomeCategory })}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {INCOME_CATEGORIES.map(c => {
                                        const Icon = c.icon;
                                        return (
                                            <SelectItem key={c.value} value={c.value}>
                                                <div className="flex items-center gap-2">
                                                    <Icon className="h-4 w-4" />
                                                    <span>{c.label}</span>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </FormField>
                        <FormField label="Source / employer">
                            <Input
                                value={form.provider ?? ""}
                                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                                placeholder="e.g. Spotify AB, CSN, Nordnet"
                            />
                        </FormField>
                    </FormRow>

                    <FormField label="Name" optional optionalNote="optional, overrides display">
                        <Input
                            value={form.name ?? ""}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="Defaults to 'Source / employer'"
                        />
                    </FormField>

                    {members.length > 1 && (
                        <FormField label="Belongs to">
                            <Select
                                value={form.owner_id}
                                onValueChange={(v) => setForm({ ...form, owner_id: v })}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {members.map(m => (
                                        <SelectItem key={m.user_id} value={m.user_id}>
                                            {m.profiles?.full_name || m.profiles?.email || m.user_id.slice(0, 8)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>
                    )}

                    <FormRow>
                        <FormField label="Monthly amount, net (kr)">
                            <Input
                                type="number"
                                inputMode="numeric"
                                value={String(form.default_amount ?? "")}
                                onChange={(e) => setForm({ ...form, default_amount: e.target.value })}
                                placeholder="0"
                            />
                        </FormField>
                        <FormField label="Tax">
                            <Select
                                value={form.tax_type ?? "no_tax"}
                                onValueChange={(v) => setForm({ ...form, tax_type: v as TaxType })}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(TAX_TYPE_LABELS) as TaxType[]).map((t) => (
                                        <SelectItem key={t} value={t}>{TAX_TYPE_LABELS[t]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>
                    </FormRow>

                    {form.tax_type === "csn_variable" && (
                        <FormField label="Tax rate (%)">
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                value={String(form.custom_tax_rate ?? "")}
                                onChange={(e) => setForm({ ...form, custom_tax_rate: e.target.value })}
                                placeholder="e.g. 30"
                            />
                        </FormField>
                    )}

                    {(() => {
                        const net = parseFloat(String(form.default_amount ?? 0)) || 0;
                        if (net <= 0 || form.tax_type === "no_tax" || !form.tax_type) return null;
                        const customRate = form.custom_tax_rate
                            ? parseFloat(String(form.custom_tax_rate)) || 0
                            : 0;
                        const { gross, tax, effectiveRate } = computeFromNet(net, form.tax_type, customRate);
                        return (
                            <div className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm">
                                <div className="flex justify-between text-muted">
                                    <span>Pre-tax (gross)</span>
                                    <span className="tabular-nums">~{Math.round(gross).toLocaleString("sv-SE")} kr</span>
                                </div>
                                <div className="flex justify-between mt-1 text-muted">
                                    <span>Tax already deducted</span>
                                    <span className="tabular-nums">~{Math.round(tax).toLocaleString("sv-SE")} kr ({Math.round(effectiveRate * 100)}%)</span>
                                </div>
                            </div>
                        );
                    })()}

                    {coParents.length > 0 && (
                        <>
                            <div className="flex items-center justify-between pt-2">
                                <div>
                                    <Label>Shared income</Label>
                                    <p className="text-sm text-muted">Split this with a co-parent.</p>
                                </div>
                                <Switch
                                    checked={!!form.is_shared}
                                    onCheckedChange={(checked) => setForm({ ...form, is_shared: checked })}
                                />
                            </div>

                            {form.is_shared && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Co-parent</Label>
                                        <Select
                                            value={form.co_parent_id ?? ""}
                                            onValueChange={(v) => setForm({ ...form, co_parent_id: v })}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select co-parent" /></SelectTrigger>
                                            <SelectContent>
                                                {coParents.map(cp => (
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
                                            value={String(form.share_percentage ?? "50")}
                                            onChange={(e) => setForm({ ...form, share_percentage: e.target.value })}
                                        />
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    <div className="flex items-center space-x-2 pt-2">
                        <Switch
                            checked={form.is_active ?? true}
                            onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                        />
                        <Label>Active</Label>
                    </div>
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
                title="Delete this income source?"
                description="This can't be undone."
                busy={entityForm.deleting}
                onConfirm={entityForm.handleDelete}
            />
        </Dialog>
    );
};
