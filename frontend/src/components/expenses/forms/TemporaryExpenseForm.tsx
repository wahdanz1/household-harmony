import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEncryptedFields, temporaryExpenseFields } from "@/hooks/useEncryptedFields";

interface TemporaryExpenseFormProps {
    householdId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

const temporaryCategories = [
    { value: "car_repair", label: "Car Repair" },
    { value: "medical", label: "Medical" },
    { value: "home_repair", label: "Home Repair" },
    { value: "gift", label: "Gift" },
    { value: "travel", label: "Travel" },
    { value: "other", label: "Other" },
];

export const TemporaryExpenseForm = ({ householdId, onSuccess, onCancel }: TemporaryExpenseFormProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const { encryptRecord } = useEncryptedFields(temporaryExpenseFields);
    const [formData, setFormData] = useState({
        description: "",
        amount: "",
        category: "other",
        notes: "",
    });
    const [saving, setSaving] = useState(false);

    const currentMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");

    const handleSave = async () => {
        if (!user) return;

        setSaving(true);

        const baseData = {
            household_id: householdId,
            month: currentMonth,
            description: formData.description,
            category: formData.category,
            amount: parseFloat(formData.amount),
            notes: formData.notes || null,
            created_by: user.id,
        };

        // Encrypt sensitive fields (description, amount)
        const data = await encryptRecord(baseData);

        const { error } = await supabase.from("temporary_expenses").insert(data);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to add temporary expense",
                variant: "destructive",
            });
            setSaving(false);
        } else {
            toast({
                title: "Success",
                description: "Temporary expense added",
            });
            onSuccess();
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Description</Label>
                <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g., Car tire replacement"
                />
            </div>

            <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {temporaryCategories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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
                <Button onClick={handleSave} disabled={saving || !formData.description || !formData.amount} className="flex-1">
                    {saving ? "Adding..." : "Add Expense"}
                </Button>
            </div>
        </div>
    );
};
