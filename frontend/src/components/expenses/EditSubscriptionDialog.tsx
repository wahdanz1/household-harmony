import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEncryptedFields, subscriptionFields } from "@/hooks/useEncryptedFields";

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

interface Subscription {
    id: string;
    name: string;
    amount: number;
    billing_cycle: string;
    category: string;
    notes?: string;
    is_active: boolean;
    billing_day?: number;
    billing_month?: number;
}

interface EditSubscriptionDialogProps {
    open: boolean;
    subscription: Subscription | null;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
}

export const EditSubscriptionDialog = ({
    open,
    subscription,
    onOpenChange,
    onSave,
}: EditSubscriptionDialogProps) => {
    const { toast } = useToast();
    const { encryptRecord } = useEncryptedFields(subscriptionFields);
    const [formData, setFormData] = useState({
        name: "",
        amount: "",
        billing_cycle: "monthly",
        category: "other",
        notes: "",
        is_active: true,
        billing_day: undefined as number | undefined,
        billing_month: undefined as number | undefined,
    });
    const [saving, setSaving] = useState(false);

    // Populate form when subscription changes
    useEffect(() => {
        if (subscription) {
            setFormData({
                name: subscription.name,
                amount: subscription.amount.toString(),
                billing_cycle: subscription.billing_cycle,
                category: subscription.category || "other",
                notes: subscription.notes || "",
                is_active: subscription.is_active,
                billing_day: subscription.billing_day,
                billing_month: subscription.billing_month,
            });
        }
    }, [subscription]);

    const handleSave = async () => {
        if (!subscription) return;
        setSaving(true);

        const baseData = {
            name: formData.name,
            amount: parseFloat(formData.amount),
            billing_cycle: formData.billing_cycle,
            category: formData.category,
            notes: formData.notes,
            is_active: formData.is_active,
            billing_day: (formData.billing_cycle === "yearly" || formData.billing_cycle === "quarterly") ? formData.billing_day : null,
            billing_month: (formData.billing_cycle === "yearly" || formData.billing_cycle === "quarterly") ? formData.billing_month : null,
        };

        // Encrypt sensitive fields (name, amount)
        const data = await encryptRecord(baseData);

        const { error } = await supabase
            .from("subscriptions")
            .update(data)
            .eq("id", subscription.id);

        setSaving(false);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to update subscription",
                variant: "destructive",
            });
        } else {
            toast({ title: "Subscription updated" });
            onSave();
            onOpenChange(false);
        }
    };

    const handleDelete = async () => {
        if (!subscription) return;

        const { error } = await supabase
            .from("subscriptions")
            .delete()
            .eq("id", subscription.id);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to delete subscription",
                variant: "destructive",
            });
        } else {
            toast({ title: "Subscription deleted" });
            onSave();
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Subscription</DialogTitle>
                    <DialogDescription>
                        Update the details for this subscription
                    </DialogDescription>
                </DialogHeader>

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
                        <Select
                            value={formData.category}
                            onValueChange={(v) => setFormData({ ...formData, category: v })}
                        >
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
                        <Select
                            value={formData.billing_cycle}
                            onValueChange={(v) => setFormData({ ...formData, billing_cycle: v })}
                        >
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

                    {(formData.billing_cycle === "yearly" || formData.billing_cycle === "quarterly") && (
                        <div className="space-y-3">
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
                            {formData.billing_cycle === "quarterly" && (
                                <p className="text-xs text-muted-foreground">
                                    Select one of the four months you get billed. We'll calculate the other three automatically (e.g., May → Aug → Nov → Feb).
                                </p>
                            )}
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
                        <Button
                            variant="destructive"
                            size="icon"
                            onClick={handleDelete}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving || !formData.name || !formData.amount}
                            className="flex-1"
                        >
                            {saving ? "Saving..." : "Update"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
