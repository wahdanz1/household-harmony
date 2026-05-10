import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEncryptedFields, subscriptionFields } from "@/hooks/useEncryptedFields";
import { useUsedCategoryValues } from "@/hooks/useUsedCategoryValues";
import { SubjectPicker } from "@/components/shared/SubjectPicker";

const subscriptionCategories = [
    { value: "streaming", label: "Streaming" },
    { value: "software", label: "Software & Apps" },
    { value: "music", label: "Music" },
    { value: "gaming", label: "Gaming" },
    { value: "gym", label: "Gym & Fitness" },
    { value: "news", label: "News & Media" },
    { value: "storage", label: "Cloud Storage" },
    { value: "education", label: "Education & Learning" },
    { value: "other", label: "Other" },
];

interface InitialValues {
    id?: string;
    name?: string;
    amount?: number | string;
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
    /** Pass to enable edit mode. */
    editingId?: string;
    initialValues?: InitialValues;
    onDelete?: () => void;
    /** Show the Create-another checkbox in add mode. */
    showCreateAnother?: boolean;
}

const blank = (): InitialValues => ({
    name: "",
    amount: "",
    billing_cycle: "monthly",
    category: "other",
    notes: "",
    is_active: true,
    subject_id: null,
});

export const SubscriptionForm = ({
    householdId, onSuccess, onCancel,
    editingId, initialValues, onDelete, showCreateAnother = true,
}: SubscriptionFormProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const { encryptRecord } = useEncryptedFields(subscriptionFields);
    const [formData, setFormData] = useState<InitialValues>(() => ({ ...blank(), ...initialValues }));
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [createAnother, setCreateAnother] = useState(false);

    useEffect(() => {
        setFormData({ ...blank(), ...initialValues });
        setCreateAnother(false);
    }, [initialValues, editingId]);

    const isEditing = !!editingId;
    const canSave = !!formData.name?.trim() && !!String(formData.amount ?? "").trim();

    const usedCategorySet = useUsedCategoryValues("subscriptions", householdId);
    const usedCats = subscriptionCategories.filter(c => usedCategorySet.has(c.value) || c.value === formData.category);
    const moreCats = subscriptionCategories.filter(c => !usedCategorySet.has(c.value) && c.value !== formData.category);

    const handleSave = async () => {
        if (!user || !canSave) return;
        setSaving(true);
        try {
            const baseData = {
                household_id: householdId,
                name: formData.name?.trim() ?? "",
                amount: parseFloat(String(formData.amount ?? 0)),
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
                toast({ title: "Subscription updated" });
            } else {
                const { error } = await supabase.from("subscriptions").insert(data);
                if (error) throw error;
                toast({ title: "Subscription added" });
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
            const { error } = await supabase.from("subscriptions").delete().eq("id", editingId);
            if (error) throw error;
            toast({ title: "Subscription deleted" });
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
                <Label>Name</Label>
                <Input
                    value={formData.name ?? ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Netflix, Spotify, etc."
                />
            </div>

            <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {usedCats.length > 0 && (
                            <SelectGroup>
                                <SelectLabel>Used in this household</SelectLabel>
                                {usedCats.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                ))}
                            </SelectGroup>
                        )}
                        {moreCats.length > 0 && (
                            <SelectGroup>
                                <SelectLabel>{usedCats.length > 0 ? "More categories" : "All categories"}</SelectLabel>
                                {moreCats.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                ))}
                            </SelectGroup>
                        )}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                    type="number"
                    value={String(formData.amount ?? "")}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0"
                />
            </div>

            <div className="space-y-2">
                <Label>Billing cycle</Label>
                <Select value={formData.billing_cycle} onValueChange={(v) => setFormData({ ...formData, billing_cycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {(formData.billing_cycle === "yearly" || formData.billing_cycle === "quarterly") && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label>Billing month</Label>
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
                    </div>
                    <div className="space-y-2">
                        <Label>Billing day</Label>
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
                    </div>
                </div>
            )}

            <SubjectPicker
                householdId={householdId}
                value={formData.subject_id}
                onChange={(id) => setFormData({ ...formData, subject_id: id })}
            />

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
