import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoIcon, Trash2 } from "lucide-react";
import { EXPENSE_CATEGORIES } from "@/constants/expenseCategories";
import { useToast } from "@/hooks/use-toast";

export interface ExpenseCategoryFormData {
    category: string;
    name: string;
    type: "static" | "dynamic";
    default_amount: string;
    electricityGrid?: string;
    electricityMarket?: string;
    waterIncluded?: boolean;
    waterCost?: string;
}

interface ExpenseCategoryFormProps {
    defaultValues?: Partial<ExpenseCategoryFormData>;
    onSubmit: (data: ExpenseCategoryFormData) => void;
    onCancel: () => void;
    submitLabel: string;
    isEditing?: boolean;
    onDelete?: () => void;
    isSaving?: boolean;
}

export const ExpenseCategoryForm = ({
    defaultValues,
    onSubmit,
    onCancel,
    submitLabel,
    isEditing = false,
    onDelete,
    isSaving = false,
}: ExpenseCategoryFormProps) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState<ExpenseCategoryFormData>({
        category: defaultValues?.category || "",
        name: defaultValues?.name || "",
        type: defaultValues?.type || "static",
        default_amount: defaultValues?.default_amount || "",
        electricityGrid: defaultValues?.electricityGrid || "",
        electricityMarket: defaultValues?.electricityMarket || "",
        waterIncluded: defaultValues?.waterIncluded ?? true,
        waterCost: defaultValues?.waterCost || "",
    });

    // Update form data when defaultValues change (important for Edit dialog)
    useEffect(() => {
        if (defaultValues) {
            setFormData(prev => ({
                ...prev,
                ...defaultValues,
                // Ensure we don't overwrite with undefined if not provided in update
                category: defaultValues.category ?? prev.category,
                name: defaultValues.name ?? prev.name,
                type: defaultValues.type ?? prev.type,
                default_amount: defaultValues.default_amount ?? prev.default_amount,
                electricityGrid: defaultValues.electricityGrid ?? prev.electricityGrid,
                electricityMarket: defaultValues.electricityMarket ?? prev.electricityMarket,
                waterIncluded: defaultValues.waterIncluded ?? prev.waterIncluded,
                waterCost: defaultValues.waterCost ?? prev.waterCost,
            }));
        }
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

        // Validate Electricity fields
        if (formData.category === "electricity") {
            if (!formData.electricityGrid || !formData.electricityMarket) {
                toast({
                    title: "Missing Electricity fields",
                    description: "Please fill in both Grid and Market amounts",
                    variant: "destructive",
                });
                return;
            }
        }

        // Validate Rent water cost if not included
        if (formData.category === "rent" && !formData.waterIncluded && !formData.waterCost) {
            toast({
                title: "Missing Water Cost",
                description: "Please enter the water cost",
                variant: "destructive",
            });
            return;
        }

        onSubmit(formData);
    };

    const selectedCategory = EXPENSE_CATEGORIES.find(cat => cat.id === formData.category);
    const CategoryIcon = selectedCategory?.icon;

    const isElectricity = formData.category === "electricity";
    const isRent = formData.category === "rent";

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

            {/* Electricity Special Fields */}
            {isElectricity && (
                <>
                    <div className="space-y-2">
                        <Label>Grid Amount *</Label>
                        <Input
                            type="number"
                            value={formData.electricityGrid}
                            onChange={(e) => setFormData({ ...formData, electricityGrid: e.target.value })}
                            placeholder="0"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Market Amount *</Label>
                        <Input
                            type="number"
                            value={formData.electricityMarket}
                            onChange={(e) => setFormData({ ...formData, electricityMarket: e.target.value })}
                            placeholder="0"
                        />
                    </div>
                </>
            )}

            {/* Rent Special Fields */}
            {isRent && (
                <>
                    <div className="flex items-center justify-between space-x-2 py-2">
                        <Label htmlFor="water-included" className="cursor-pointer">Water Included</Label>
                        <Switch
                            id="water-included"
                            checked={formData.waterIncluded}
                            onCheckedChange={(checked) => setFormData({ ...formData, waterIncluded: checked })}
                        />
                    </div>
                    {!formData.waterIncluded && (
                        <div className="space-y-2">
                            <Label>Water Cost *</Label>
                            <Input
                                type="number"
                                value={formData.waterCost}
                                onChange={(e) => setFormData({ ...formData, waterCost: e.target.value })}
                                placeholder="0"
                            />
                        </div>
                    )}
                </>
            )}

            {/* Default Amount - only show if NOT Electricity (since it has Grid + Market) */}
            {!isElectricity && (
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
            )}

            {/* For Electricity, calculate total from Grid + Market */}
            {isElectricity && (
                <div className="space-y-2">
                    <Label>Total Amount (Grid + Market)</Label>
                    <Input
                        type="number"
                        value={(parseFloat(formData.electricityGrid || "0") + parseFloat(formData.electricityMarket || "0")).toString()}
                        disabled
                        className="bg-muted"
                    />
                </div>
            )}

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
