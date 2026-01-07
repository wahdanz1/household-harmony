import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEncryptedFields, sharedExpenseFields } from "@/hooks/useEncryptedFields";

interface SharedExpenseFormProps {
    householdId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export const SharedExpenseForm = ({ householdId, onSuccess, onCancel }: SharedExpenseFormProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const { encryptRecord } = useEncryptedFields(sharedExpenseFields);
    const [coParents, setCoParents] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        description: "",
        amount: "",
        co_parent_id: "",
        notes: "",
        paid_by: "user" as "user" | "co_parent",
    });
    const [saving, setSaving] = useState(false);

    const currentMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");

    useEffect(() => {
        const fetchCoParents = async () => {
            const { data } = await supabase
                .from("co_parents")
                .select("*")
                .eq("household_id", householdId);
            setCoParents(data || []);
            if (data && data.length > 0) {
                setFormData(prev => ({ ...prev, co_parent_id: data[0].id }));
            }
        };
        fetchCoParents();
    }, [householdId]);

    const handleSave = async () => {
        if (!user) return;

        setSaving(true);

        const baseData = {
            household_id: householdId,
            co_parent_id: formData.co_parent_id,
            month: currentMonth,
            description: formData.description,
            amount: parseFloat(formData.amount),
            notes: formData.notes,
            paid_by: formData.paid_by,
            created_by: user.id,
        };

        // Encrypt sensitive fields (description, amount)
        const data = await encryptRecord(baseData);

        const { error } = await supabase.from("shared_expenses").insert(data);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to add shared expense",
                variant: "destructive",
            });
            setSaving(false);
        } else {
            toast({
                title: "Success",
                description: "Shared expense added",
            });
            onSuccess();
        }
    };

    if (coParents.length === 0) {
        return (
            <div className="text-center py-8 space-y-4">
                <p className="text-muted-foreground">
                    No co-parents configured.
                </p>
                <p className="text-sm text-muted-foreground">
                    Add a co-parent in Settings first to use shared expenses.
                </p>
                <Button onClick={onCancel} variant="outline">
                    Close
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Co-Parent</Label>
                <Select value={formData.co_parent_id} onValueChange={(v) => setFormData({ ...formData, co_parent_id: v })}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select co-parent" />
                    </SelectTrigger>
                    <SelectContent>
                        {coParents.map((cp) => (
                            <SelectItem key={cp.id} value={cp.id}>
                                {cp.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Description</Label>
                <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g., Rain clothing for school"
                />
            </div>

            <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0"
                />
            </div>

            <div className="space-y-2">
                <Label>Paid by</Label>
                <Select value={formData.paid_by} onValueChange={(v: "user" | "co_parent") => setFormData({ ...formData, paid_by: v })}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="user">You</SelectItem>
                        <SelectItem value="co_parent">Co-parent</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional details"
                />
            </div>

            <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={onCancel} className="flex-1">
                    Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || !formData.description || !formData.amount || !formData.co_parent_id} className="flex-1">
                    {saving ? "Adding..." : "Add Expense"}
                </Button>
            </div>
        </div>
    );
};
