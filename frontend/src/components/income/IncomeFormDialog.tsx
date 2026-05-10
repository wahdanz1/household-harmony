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
import { Loader2, Trash2 } from "lucide-react";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    useEncryptedFields,
    incomeSourceFields,
    monthlyIncomeFields,
} from "@/hooks/useEncryptedFields";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";

const INCOME_CATEGORIES = [
    { value: "salary", label: "Salary" },
    { value: "business_income", label: "Business income" },
    { value: "government_benefits", label: "Government benefits" },
    { value: "investment_income", label: "Investment income" },
    { value: "other", label: "Other" },
] as const;

type IncomeCategory = typeof INCOME_CATEGORIES[number]["value"];

interface InitialValues {
    id?: string;
    category?: IncomeCategory;
    name?: string;
    owner_id?: string;
    default_amount?: number | string;
    is_shared?: boolean;
    co_parent_id?: string | null;
    share_percentage?: number | string | null;
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
    default_amount: "0",
    owner_id: defaultOwnerId,
    is_shared: false,
    co_parent_id: "",
    share_percentage: "50",
});

export const IncomeFormDialog = ({
    open, onOpenChange, mode, householdId, members, coParents = [],
    financialMonthStart, initialValues, onSuccess,
}: IncomeFormDialogProps) => {
    const defaultOwnerId = initialValues?.owner_id || members[0]?.user_id || "";
    const [form, setForm] = useState<InitialValues>(() => ({
        ...blankForm(defaultOwnerId),
        ...initialValues,
    }));
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [createAnother, setCreateAnother] = useState(false);

    const { encryptRecord: encryptSource } = useEncryptedFields(incomeSourceFields);
    const { encryptRecord: encryptMonthly } = useEncryptedFields(monthlyIncomeFields);

    useEffect(() => {
        if (!open) return;
        setForm({ ...blankForm(defaultOwnerId), ...initialValues });
        setCreateAnother(false);
    }, [open, initialValues, defaultOwnerId]);

    const editingId = mode === "edit" ? initialValues?.id : undefined;
    const canSave = !!form.name?.trim() && parseFloat(String(form.default_amount ?? 0)) >= 0 && !!form.owner_id;

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            const numericAmount = parseFloat(String(form.default_amount ?? 0));
            const baseData = {
                household_id: householdId,
                category: form.category,
                name: form.name?.trim() ?? "",
                default_amount: numericAmount,
                created_by: form.owner_id ?? "",
                is_shared: !!form.is_shared,
                co_parent_id: form.is_shared ? (form.co_parent_id || null) : null,
                share_percentage: form.is_shared ? parseFloat(String(form.share_percentage ?? 50)) : null,
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

            toast.success(editingId ? "Income source updated" : "Income source added");
            onSuccess?.();

            if (mode === "add" && createAnother) {
                setForm(blankForm(defaultOwnerId));
            } else {
                onOpenChange(false);
            }
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to save income source");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editingId) return;
        setDeleting(true);
        try {
            const { error } = await supabase.from("income_sources").delete().eq("id", editingId);
            if (error) throw error;
            toast.success("Income source deleted");
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
                    <DialogTitle>{mode === "edit" ? "Edit income source" : "Add income source"}</DialogTitle>
                    <DialogDescription>
                        Recurring monthly income — salary, CSN, government benefits, etc.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                            value={form.category}
                            onValueChange={(v) => setForm({ ...form, category: v as IncomeCategory })}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {INCOME_CATEGORIES.map(c => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                            value={form.name ?? ""}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Daniel salary"
                        />
                    </div>

                    {members.length > 1 && (
                        <div className="space-y-2">
                            <Label>Belongs to</Label>
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
                        </div>
                    )}

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

                    {coParents.length > 0 && (
                        <>
                            <div className="flex items-center justify-between pt-2">
                                <div>
                                    <Label>Shared income</Label>
                                    <p className="text-sm text-muted-foreground">Split this with a co-parent.</p>
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
