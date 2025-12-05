import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface InsuranceFormProps {
    householdId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

const insuranceTypes = [
    { value: "home", label: "Home Insurance", color: "#3B82F6" },
    { value: "car", label: "Car Insurance", color: "#EF4444" },
    { value: "health", label: "Health Insurance", color: "#10B981" },
    { value: "life", label: "Life Insurance", color: "#8B5CF6" },
    { value: "pet", label: "Pet Insurance", color: "#F59E0B" },
    { value: "travel", label: "Travel Insurance", color: "#06B6D4" },
    { value: "liability", label: "Liability Insurance", color: "#EC4899" },
    { value: "other", label: "Other", color: "#64748B" },
];

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export const InsuranceForm = ({ householdId, onSuccess, onCancel }: InsuranceFormProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [coParents, setCoParents] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        name: "",
        provider: "",
        type: "home",
        total_amount: "",
        payment_frequency: "yearly",
        invoice_month: "",
        notes: "",
        is_active: true,
        is_shared: false,
        co_parent_id: "",
        share_percentage: "50",
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchCoParents = async () => {
            const { data } = await supabase
                .from("co_parents")
                .select("*")
                .eq("household_id", householdId);
            setCoParents(data || []);
        };
        fetchCoParents();
    }, [householdId]);

    const handleSave = async () => {
        if (!user) return;

        setSaving(true);

        const data = {
            household_id: householdId,
            name: formData.name,
            provider: formData.provider || null,
            type: formData.type,
            total_amount: parseFloat(formData.total_amount),
            payment_frequency: formData.payment_frequency,
            invoice_month: formData.invoice_month && formData.invoice_month !== "0" ? parseInt(formData.invoice_month) : null,
            notes: formData.notes || null,
            is_active: formData.is_active,
            is_shared: formData.is_shared,
            co_parent_id: formData.is_shared ? formData.co_parent_id : null,
            share_percentage: formData.is_shared ? parseFloat(formData.share_percentage) : 50,
            created_by: user.id,
        };

        const { error } = await supabase.from("insurances").insert(data);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to save insurance",
                variant: "destructive",
            });
            setSaving(false);
        } else {
            toast({
                title: "Success",
                description: "Insurance added",
            });
            onSuccess();
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Name</Label>
                <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Home Insurance 2024"
                />
            </div>

            <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {insuranceTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                                {type.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Provider (Optional)</Label>
                <Input
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    placeholder="Insurance Company Name"
                />
            </div>

            <div className="space-y-2">
                <Label>Total Amount</Label>
                <Input
                    type="number"
                    value={formData.total_amount}
                    onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                    placeholder="0"
                />
            </div>

            <div className="space-y-2">
                <Label>Payment Frequency</Label>
                <Select value={formData.payment_frequency} onValueChange={(v) => setFormData({ ...formData, payment_frequency: v })}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="semi_annually">Semi-annually (6 months)</SelectItem>
                        <SelectItem value="quarterly">Quarterly (3 months)</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {formData.payment_frequency === "yearly" && (
                <div className="space-y-2">
                    <Label>Invoice Month (Optional)</Label>
                    <Select value={formData.invoice_month} onValueChange={(v) => setFormData({ ...formData, invoice_month: v })}>
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
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional notes"
                />
            </div>

            <div className="flex items-center space-x-2">
                <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
            </div>

            {coParents.length > 0 && (
                <div className="space-y-4 border-t border-border pt-4">
                    <div className="flex items-center space-x-2">
                        <Switch
                            checked={formData.is_shared}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_shared: checked })}
                        />
                        <Label>Shared with co-parent (50/50)</Label>
                    </div>

                    {formData.is_shared && (
                        <>
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
                                <Label>Your Share (%)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={formData.share_percentage}
                                    onChange={(e) => setFormData({ ...formData, share_percentage: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    You pay {formData.share_percentage}%, they pay {100 - parseFloat(formData.share_percentage || "0")}%
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={onCancel} className="flex-1">
                    Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || !formData.name || !formData.total_amount} className="flex-1">
                    {saving ? "Adding..." : "Add Insurance"}
                </Button>
            </div>
        </div>
    );
};
