import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEncryptedFields, insuranceFields } from "@/hooks/useEncryptedFields";

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
});

export const InsuranceForm = ({
    householdId, onSuccess, onCancel,
    editingId, initialValues, onDelete, showCreateAnother = true,
}: InsuranceFormProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const { encryptRecord } = useEncryptedFields(insuranceFields);
    const [coParents, setCoParents] = useState<any[]>([]);
    const [formData, setFormData] = useState<InitialValues>(() => ({ ...blank(), ...initialValues }));
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [createAnother, setCreateAnother] = useState(false);

    useEffect(() => {
        const fetchCoParents = async () => {
            const { data } = await supabase.from("co_parents").select("*").eq("household_id", householdId);
            setCoParents(data || []);
        };
        fetchCoParents();
    }, [householdId]);

    useEffect(() => {
        setFormData({ ...blank(), ...initialValues });
        setCreateAnother(false);
    }, [initialValues, editingId]);

    const isEditing = !!editingId;
    const isRecurringNonMonthly = formData.payment_frequency && formData.payment_frequency !== "monthly";
    const canSave = !!formData.name?.trim() && !!String(formData.total_amount ?? "").trim();

    const handleSave = async () => {
        if (!user || !canSave) return;
        setSaving(true);
        try {
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
                created_by: user.id,
            };
            const data = await encryptRecord(baseData);

            if (editingId) {
                const { error } = await supabase.from("insurances").update(data as any).eq("id", editingId);
                if (error) throw error;
                toast({ title: "Insurance updated" });
            } else {
                const { error } = await supabase.from("insurances").insert(data as any);
                if (error) throw error;
                toast({ title: "Insurance added" });
            }

            onSuccess();
            if (!editingId && createAnother) {
                setFormData(blank());
            }
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editingId || !onDelete) return;
        setDeleting(true);
        try {
            const { error } = await supabase.from("insurances").delete().eq("id", editingId);
            if (error) throw error;
            toast({ title: "Insurance deleted" });
            onDelete();
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {insuranceTypes.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Provider</Label>
                <Input
                    value={formData.provider ?? ""}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    placeholder="Länsförsäkringar, If, Folksam…"
                />
            </div>

            <div className="space-y-2">
                <Label>Name (optional)</Label>
                <Input
                    value={formData.name ?? ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Tiebreaker, e.g. 'Kia' or 'child name'"
                />
            </div>

            <div className="space-y-2">
                <Label>Total amount</Label>
                <Input
                    type="number"
                    value={String(formData.total_amount ?? "")}
                    onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                    placeholder="0"
                />
            </div>

            <div className="space-y-2">
                <Label>Payment frequency</Label>
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
            </div>

            {isRecurringNonMonthly && (
                <div className="space-y-2">
                    <Label>Invoice month (optional)</Label>
                    <Select
                        value={String(formData.invoice_month ?? "")}
                        onValueChange={(v) => setFormData({ ...formData, invoice_month: v })}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select month when invoice arrives" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0">Not set</SelectItem>
                            {monthNames.map((month, index) => (
                                <SelectItem key={index + 1} value={(index + 1).toString()}>
                                    {month}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                    value={formData.notes ?? ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional notes"
                />
            </div>

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

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4">
                <div className="flex items-center gap-3">
                    {isEditing && onDelete ? (
                        <Button variant="destructive" onClick={handleDelete} disabled={saving || deleting}>
                            {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Delete
                        </Button>
                    ) : showCreateAnother ? (
                        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                            <Checkbox checked={createAnother} onCheckedChange={(v) => setCreateAnother(v === true)} />
                            Create another
                        </label>
                    ) : null}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={!canSave || saving}>
                        {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : (isEditing ? "Save" : "Add")}
                    </Button>
                </div>
            </div>
        </div>
    );
};
