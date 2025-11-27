import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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

    // Special fields for Electricity
    const [electricityGrid, setElectricityGrid] = useState("");
    const [electricityMarket, setElectricityMarket] = useState("");

    // Special fields for Rent
    const [waterIncluded, setWaterIncluded] = useState(true);
    const [waterCost, setWaterCost] = useState("");

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

        // Validate Electricity fields
        if (formData.category === "electricity") {
            if (!electricityGrid || !electricityMarket) {
                toast({
                    title: "Missing Electricity fields",
                    description: "Please fill in both Grid and Market amounts",
                    variant: "destructive",
                });
                return;
            }
        }

        // Validate Rent water cost if not included
        if (formData.category === "rent" && !waterIncluded && !waterCost) {
            toast({
                title: "Missing Water Cost",
                description: "Please enter the water cost",
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

        // Build metadata object
        const metadata: any = {};

        if (formData.category === "electricity") {
            metadata.electricity_grid = parseFloat(electricityGrid);
            metadata.electricity_market = parseFloat(electricityMarket);
        }

        if (formData.category === "rent") {
            metadata.water_included = waterIncluded;
            if (!waterIncluded) {
                metadata.water_cost = parseFloat(waterCost);
            }
        }

        const { error } = await supabase.from("expense_categories").insert({
            household_id: householdId,
            category: formData.category,
            name: formData.name,
            type: formData.type,
            default_amount: parseFloat(formData.default_amount),
            created_by: user.id,
            is_active: true,
            sort_order: 999,
            metadata: Object.keys(metadata).length > 0 ? metadata : {},
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
                            value={electricityGrid}
                            onChange={(e) => setElectricityGrid(e.target.value)}
                            placeholder="0"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Market Amount *</Label>
                        <Input
                            type="number"
                            value={electricityMarket}
                            onChange={(e) => setElectricityMarket(e.target.value)}
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
                            checked={waterIncluded}
                            onCheckedChange={setWaterIncluded}
                        />
                    </div>
                    {!waterIncluded && (
                        <div className="space-y-2">
                            <Label>Water Cost *</Label>
                            <Input
                                type="number"
                                value={waterCost}
                                onChange={(e) => setWaterCost(e.target.value)}
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
                        value={(parseFloat(electricityGrid || "0") + parseFloat(electricityMarket || "0")).toString()}
                        disabled
                        className="bg-muted"
                    />
                </div>
            )}

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
