import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEncryptedFields, subscriptionFields } from "@/hooks/useEncryptedFields";

interface SubscriptionFormProps {
    householdId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

const subscriptionCategories = [
    { value: "streaming", label: "Streaming", color: "#EC4899" },
    { value: "software", label: "Software & Apps", color: "#8B5CF6" },
    { value: "music", label: "Music", color: "#10B981" },
    { value: "gaming", label: "Gaming", color: "#F59E0B" },
    { value: "gym", label: "Gym & Fitness", color: "#EF4444" },
    { value: "news", label: "News & Media", color: "#3B82F6" },
    { value: "storage", label: "Cloud Storage", color: "#06B6D4" },
    { value: "education", label: "Education & Learning", color: "#A855F7" },
    { value: "other", label: "Other", color: "#64748B" },
];

export const SubscriptionForm = ({ householdId, onSuccess, onCancel }: SubscriptionFormProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const { encryptRecord } = useEncryptedFields(subscriptionFields);
    const [formData, setFormData] = useState<{
        name: string;
        amount: string;
        billing_cycle: string;
        category: string;
        notes: string;
        is_active: boolean;
        billing_day?: number;
        billing_month?: number;
    }>({
        name: "",
        amount: "",
        billing_cycle: "monthly",
        category: "other",
        notes: "",
        is_active: true,
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!user) return;

        setSaving(true);

        const baseData = {
            household_id: householdId,
            name: formData.name,
            amount: parseFloat(formData.amount),
            billing_cycle: formData.billing_cycle,
            category: formData.category,
            notes: formData.notes,
            is_active: formData.is_active,
            created_by: user.id,
            billing_day: formData.billing_cycle === "yearly" ? formData.billing_day : null,
            billing_month: formData.billing_cycle === "yearly" ? formData.billing_month : null,
        };

        // Encrypt sensitive fields (name, amount)
        const data = await encryptRecord(baseData);

        const { error } = await supabase.from("subscriptions").insert(data);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to save subscription",
                variant: "destructive",
            });
            setSaving(false);
        } else {
            toast({
                title: "Success",
                description: "Subscription added",
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
                    placeholder="Netflix, Spotify, etc."
                />
            </div>

            <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {subscriptionCategories.map((cat) => (
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
                <Label>Billing Cycle</Label>
                <Select value={formData.billing_cycle} onValueChange={(v) => setFormData({ ...formData, billing_cycle: v })}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {formData.billing_cycle === "yearly" && (
                <div className="grid-2">
                    <div className="space-y-2">
                        <Label>Billing Month</Label>
                        <Select
                            value={formData.billing_month?.toString()}
                            onValueChange={(v) => setFormData({ ...formData, billing_month: parseInt(v) })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                    <SelectItem key={month} value={month.toString()}>
                                        {format(new Date(2024, month - 1, 1), "MMMM")}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Billing Day</Label>
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
                            placeholder="Day (1-31)"
                        />
                    </div>
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

            <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={onCancel} className="flex-1">
                    Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || !formData.name || !formData.amount} className="flex-1">
                    {saving ? "Adding..." : "Add Subscription"}
                </Button>
            </div>
        </div>
    );
};
