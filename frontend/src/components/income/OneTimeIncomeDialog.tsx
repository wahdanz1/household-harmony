import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Gift, Plus } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEncryptedFields } from "@/hooks/useEncryptedFields";

// Field config for one-time income encryption
const oneTimeIncomeFields = [
    { original: 'source', encrypted: 'encrypted_source' },
    { original: 'amount', encrypted: 'encrypted_amount' },
    { original: 'description', encrypted: 'encrypted_description' },
];

const incomeCategories = [
    { value: "gift", label: "Gift Money" },
    { value: "lottery", label: "Lottery/Winnings" },
    { value: "tax_refund", label: "Tax Refund" },
    { value: "bonus", label: "Bonus Payment" },
    { value: "sale", label: "Sale of Items" },
    { value: "inheritance", label: "Inheritance" },
    { value: "other", label: "Other" },
];

interface OneTimeIncomeDialogProps {
    householdId: string;
    onSuccess: () => void;
}

export const OneTimeIncomeDialog = ({ householdId, onSuccess }: OneTimeIncomeDialogProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const { encryptRecord } = useEncryptedFields(oneTimeIncomeFields);
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        source: "",
        category: "gift",
        amount: "",
        description: "",
    });

    const currentMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");

    const resetForm = () => {
        setFormData({
            source: "",
            category: "gift",
            amount: "",
            description: "",
        });
    };

    const handleSave = async () => {
        if (!user) return;

        setSaving(true);

        const baseData = {
            household_id: householdId,
            month: currentMonth,
            source: formData.source || incomeCategories.find(c => c.value === formData.category)?.label || "One-time income",
            amount: parseFloat(formData.amount),
            description: formData.description || null,
            created_by: user.id,
        };

        // Encrypt sensitive fields
        const data = await encryptRecord(baseData);

        const { error } = await supabase.from("one_time_incomes" as any).insert(data);

        setSaving(false);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to add one-time income",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: "One-time income added",
            });
            resetForm();
            setIsOpen(false);
            onSuccess();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) resetForm();
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="h-10">
                    <Gift className="h-4 w-4 mr-2" />
                    One-Time Income
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add One-Time Income</DialogTitle>
                    <DialogDescription>
                        Record a one-time income like gift money, lottery winnings, or tax refund
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {incomeCategories.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                        {cat.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Source (Optional)</Label>
                        <Input
                            value={formData.source}
                            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                            placeholder="e.g., Christmas gift from parents"
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
                        <Label>Description (Optional)</Label>
                        <Textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Additional details..."
                        />
                    </div>
                </div>
                <div className="flex gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving || !formData.amount} className="flex-1">
                        {saving ? "Adding..." : "Add Income"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
