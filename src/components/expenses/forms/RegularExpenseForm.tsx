import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoIcon } from "lucide-react";
import { EXPENSE_CATEGORIES } from "@/constants/expenseCategories";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface RegularExpenseFormProps {
    householdId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export const RegularExpenseForm = ({ householdId, onSuccess, onCancel }: RegularExpenseFormProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        category: "",
        name: "",
        type: "static" as "static" | "dynamic",
        default_amount: "",
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!formData.category || !formData.name || !formData.default_amount) {
            toast({
                title: "Missing fields",
                description: "Please fill in all required fields",
                variant: "destructive",
            });
            return;
        }

        setSaving(true);

        if (!user) {
            toast({
                title: "Error",
                description: "You must be logged in to create an expense",
                variant: "destructive",
            });
            setSaving(false);
            return;
        }

        const { error } = await supabase.from("expense_categories").insert({
            household_id: householdId,
            category: formData.category,
            name: formData.name,
            type: formData.type,
            default_amount: parseFloat(formData.default_amount),
            created_by: user.id,
            is_active: true,
            sort_order: 999, // Place at end by default
        });

        setSaving(false);

        if (error) {
            console.error("Error creating expense:", error);
            toast({
                title: "Error",
                description: `Failed to create expense: ${error.message}`,
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: "Expense created successfully",
            });
            onSuccess();
        }
    };

    const selectedCategory = EXPENSE_CATEGORIES.find(cat => cat.id === formData.category);
    const CategoryIcon = selectedCategory?.icon;

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a category">
                            {selectedCategory && (
                                <div className="flex items-center gap-2">
                                    {CategoryIcon && <CategoryIcon className="h-4 w-4" />}
                                    <span>{selectedCategory.label}</span>
                                </div>
                            )}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {EXPENSE_CATEGORIES.map((cat) => {
                            const Icon = cat.icon;
                            return (
                                <SelectItem key={cat.id} value={cat.id}>
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
                <Label>Title *</Label>
                <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Monthly Rent, Weekly Groceries"
                />
            </div>

            <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as "static" | "dynamic" })}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="static">Static (Fixed amount each month)</SelectItem>
                        <SelectItem value="dynamic">Dynamic (Varies each month)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Label>Default Amount *</Label>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <InfoIcon className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Enter the usual monthly amount for this expense.</p>
                                <p>This will be pre-filled each month to save you time.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <Input
                    type="number"
                    value={formData.default_amount}
                    onChange={(e) => setFormData({ ...formData, default_amount: e.target.value })}
                    placeholder="0"
                />
            </div>

            <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={onCancel} className="flex-1">
                    Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={saving} className="flex-1">
                    {saving ? "Creating..." : "Create Expense"}
                </Button>
            </div>
        </div>
    );
};
