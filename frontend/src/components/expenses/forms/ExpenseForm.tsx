import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { InfoIcon, Trash2, CreditCard } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { EXPENSE_CATEGORIES } from "@/constants/expenseCategories";

export interface ExpenseFormData {
    category?: string;
    name: string;
    default_amount: string;
    is_credit?: boolean;
}

interface ExpenseFormProps {
    defaultValues: ExpenseFormData;
    onSubmit: (data: ExpenseFormData) => void;
    onCancel: () => void;
    submitLabel?: string;
    isSaving?: boolean;
    isEditing?: boolean;
    onDelete?: () => void;
}

export const ExpenseForm = ({
    defaultValues,
    onSubmit,
    onCancel,
    submitLabel = "Save",
    isSaving = false,
    isEditing = false,
    onDelete,
}: ExpenseFormProps) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState<ExpenseFormData>(defaultValues);

    // Derived values for conditional rendering
    const selectedCategory = EXPENSE_CATEGORIES.find(cat => cat.id === formData.category);
    const CategoryIcon = selectedCategory?.icon;

    useEffect(() => {
        setFormData((prev) => ({
            ...prev,
            category: defaultValues.category ?? prev.category,
            name: defaultValues.name ?? prev.name,
            default_amount: defaultValues.default_amount ?? prev.default_amount,
            is_credit: defaultValues.is_credit ?? prev.is_credit ?? false,
        }));
    }, [defaultValues]);

    const handleSubmit = () => {
        if (!formData.category || !formData.name || !formData.default_amount) {
            toast({
                title: "Missing fields",
                description: "Please fill in all required fields",
                variant: "destructive",
            });
            return;
        }

        onSubmit(formData);
    };

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

            {/* Default Amount */}
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

            {/* Credit Card Toggle */}
            <div className="list-row-compact">
                <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <div>
                        <Label htmlFor="is-credit" className="text-sm font-medium cursor-pointer">Credit Card Expense</Label>
                        <p className="text-xs text-muted-foreground">Track this as a credit card expense</p>
                    </div>
                </div>
                <Switch
                    id="is-credit"
                    checked={formData.is_credit || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_credit: checked })}
                />
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-col gap-2 pt-4">
                <Button onClick={handleSubmit} disabled={isSaving} className="w-full">
                    {isSaving ? "Saving..." : submitLabel}
                </Button>

                <div className="flex gap-2 w-full">
                    <Button variant="outline" onClick={onCancel} className="flex-1">
                        Cancel
                    </Button>

                    {isEditing && onDelete && (
                        <Button
                            variant="destructive"
                            onClick={onDelete}
                            className="flex-1"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
