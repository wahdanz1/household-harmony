import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Gift, Ticket, Receipt, Star, Tag, Crown, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useToast } from "@/hooks/use-toast";
import { useEncryptedFields, monthlyIncomeFields } from "@/hooks/useEncryptedFields";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";

const oneTimeCategories = [
    { value: "gift", label: "Gift Money", icon: Gift },
    { value: "lottery", label: "Lottery/Winnings", icon: Ticket },
    { value: "tax_refund", label: "Tax Refund", icon: Receipt },
    { value: "bonus", label: "Bonus Payment", icon: Star },
    { value: "sale", label: "Sale of Items", icon: Tag },
    { value: "inheritance", label: "Inheritance", icon: Crown },
    { value: "other", label: "Other", icon: MoreHorizontal },
];

interface OneTimeIncomeDialogProps {
    householdId: string;
    onSuccess: () => void;
}

export const OneTimeIncomeDialog = ({ householdId, onSuccess }: OneTimeIncomeDialogProps) => {
    const { user } = useAuth();
    const { financialMonthStart } = useHousehold();
    const { toast } = useToast();
    const { encryptRecord } = useEncryptedFields(monthlyIncomeFields);
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        category: "",
        amount: "",
        description: "",
    });

    const resetForm = () => {
        setFormData({ name: "", category: "", amount: "", description: "" });
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);

        const currentMonth = getCurrentFinancialMonth(financialMonthStart);
        const { start, end } = getFinancialMonthRange(currentMonth, financialMonthStart);
        const categoryLabel = oneTimeCategories.find(c => c.value === formData.category)?.label
            ?? "One-time income";

        const baseData = {
            household_id: householdId,
            income_source_id: null,
            month: currentMonth,
            month_start: format(start, "yyyy-MM-dd"),
            month_end: format(end, "yyyy-MM-dd"),
            one_time_name: formData.name.trim() || categoryLabel,
            one_time_category: formData.category,
            budget_snapshot: parseFloat(formData.amount),
            notes: formData.description.trim() || null,
            created_by: user.id,
        };

        const data = await encryptRecord(baseData);
        const { error } = await supabase.from("monthly_incomes").insert(data as any);

        setSaving(false);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to add one-time income",
                variant: "destructive",
            });
        } else {
            toast({ title: "Success", description: "One-time income added" });
            resetForm();
            setIsOpen(false);
            onSuccess();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="lg" className="w-full justify-center gap-2">
                    <Gift className="h-4 w-4" />
                    One-off
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add one-off income</DialogTitle>
                    <DialogDescription>
                        A one-time inflow outside your regular sources — gift, refund, bonus, sale, etc.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                                {oneTimeCategories.map((cat) => {
                                    const Icon = cat.icon;
                                    return (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-4 w-4" />
                                                <span>{cat.label}</span>
                                            </div>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Name (Optional)</Label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                    <Button onClick={handleSave} disabled={saving || !formData.amount || !formData.category} className="flex-1">
                        {saving ? "Adding..." : "Add Income"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
