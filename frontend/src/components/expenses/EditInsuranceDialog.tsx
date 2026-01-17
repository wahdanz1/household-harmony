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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { insuranceTypes, monthNames } from "@/constants/insuranceTypes";
import { useEncryptedFields, insuranceFields } from "@/hooks/useEncryptedFields";

interface Insurance {
    id: string;
    name: string;
    provider: string;
    category: string;
    total_amount: number;
    payment_frequency: string;
    invoice_month?: number | string;
    notes?: string;
    is_active: boolean;
    is_shared: boolean;
    co_parent_id?: string;
    share_percentage: number;
}

interface EditInsuranceDialogProps {
    open: boolean;
    insurance: Insurance | null;
    coParents: { id: string; name: string }[];
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
}

export const EditInsuranceDialog = ({
    open,
    insurance,
    coParents,
    onOpenChange,
    onSave,
}: EditInsuranceDialogProps) => {
    const { toast } = useToast();
    const { encryptRecord } = useEncryptedFields(insuranceFields);
    const [formData, setFormData] = useState({
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
    const [saving, setSaving] = useState(false);

    // Populate form when insurance changes
    useEffect(() => {
        if (insurance) {
            // Handle old date strings in invoice_month
            let monthValue = "";
            if (insurance.invoice_month) {
                const dateStr = insurance.invoice_month.toString();
                if (dateStr.includes("-")) {
                    const date = new Date(dateStr);
                    monthValue = (date.getMonth() + 1).toString();
                } else {
                    monthValue = dateStr;
                }
            }

            setFormData({
                name: insurance.name,
                provider: insurance.provider || "",
                category: insurance.category,
                total_amount: insurance.total_amount.toString(),
                payment_frequency: insurance.payment_frequency,
                invoice_month: monthValue,
                notes: insurance.notes || "",
                is_active: insurance.is_active,
                is_shared: insurance.is_shared,
                co_parent_id: insurance.co_parent_id || "",
                share_percentage: insurance.share_percentage.toString(),
            });
        }
    }, [insurance]);

    const handleSave = async () => {
        if (!insurance) return;
        setSaving(true);

        const baseData = {
            name: formData.name,
            provider: formData.provider || null,
            category: formData.category,
            total_amount: parseFloat(formData.total_amount),
            payment_frequency: formData.payment_frequency,
            invoice_month: formData.invoice_month && formData.invoice_month !== "0"
                ? parseInt(formData.invoice_month)
                : null,
            notes: formData.notes || null,
            is_active: formData.is_active,
            is_shared: formData.is_shared,
            co_parent_id: formData.is_shared ? formData.co_parent_id : null,
            share_percentage: formData.is_shared ? parseFloat(formData.share_percentage) : 50,
        };

        // Encrypt sensitive fields (name, total_amount)
        const data = await encryptRecord(baseData);

        const { error } = await supabase
            .from("insurances")
            .update(data as any)
            .eq("id", insurance.id);

        setSaving(false);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to update insurance",
                variant: "destructive",
            });
        } else {
            toast({ title: "Insurance updated" });
            onSave();
            onOpenChange(false);
        }
    };

    const handleDelete = async () => {
        if (!insurance) return;

        const { error } = await supabase
            .from("insurances")
            .delete()
            .eq("id", insurance.id);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to delete insurance",
                variant: "destructive",
            });
        } else {
            toast({ title: "Insurance deleted" });
            onSave();
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Insurance</DialogTitle>
                    <DialogDescription>
                        Update the details for this insurance policy
                    </DialogDescription>
                </DialogHeader>

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
                        <Select
                            value={formData.category}
                            onValueChange={(v) => setFormData({ ...formData, category: v })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {insuranceTypes.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        <div className="flex items-center gap-2">
                                            <type.icon className="h-4 w-4" />
                                            {type.label}
                                        </div>
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
                        <Select
                            value={formData.payment_frequency}
                            onValueChange={(v) => setFormData({ ...formData, payment_frequency: v })}
                        >
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
                            <Select
                                value={formData.invoice_month}
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
                                <Label>Shared with co-parent</Label>
                            </div>

                            {formData.is_shared && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Co-Parent</Label>
                                        <Select
                                            value={formData.co_parent_id}
                                            onValueChange={(v) => setFormData({ ...formData, co_parent_id: v })}
                                        >
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
                            disabled={saving || !formData.name || !formData.total_amount}
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
