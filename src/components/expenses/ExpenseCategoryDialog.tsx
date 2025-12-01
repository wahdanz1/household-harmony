import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";

interface ExpenseCategoryDialogProps {
    open: boolean;
    editingCategoryId: string | null;
    categoryFormData: {
        name: string;
        type: "static" | "dynamic";
        default_amount: string;
    };
    expenseCategories: any[];
    electricityGrid: string;
    electricityMarket: string;
    waterIncluded: boolean;
    waterCost: string;
    onOpenChange: (open: boolean) => void;
    onFormDataChange: (data: any) => void;
    onElectricityGridChange: (value: string) => void;
    onElectricityMarketChange: (value: string) => void;
    onWaterIncludedChange: (value: boolean) => void;
    onWaterCostChange: (value: string) => void;
    onSave: () => void;
    onDelete: (id: string) => void;
}

export const ExpenseCategoryDialog = ({
    open,
    editingCategoryId,
    categoryFormData,
    expenseCategories,
    electricityGrid,
    electricityMarket,
    waterIncluded,
    waterCost,
    onOpenChange,
    onFormDataChange,
    onElectricityGridChange,
    onElectricityMarketChange,
    onWaterIncludedChange,
    onWaterCostChange,
    onSave,
    onDelete,
}: ExpenseCategoryDialogProps) => {
    const editingCategory = expenseCategories.find(c => c.id === editingCategoryId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingCategoryId ? "Edit" : "Add"} Expense Category</DialogTitle>
                    <DialogDescription>
                        Create a new expense category for tracking
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                            value={categoryFormData.name}
                            onChange={(e) => onFormDataChange({ ...categoryFormData, name: e.target.value })}
                            placeholder="e.g., Rent, Groceries"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={categoryFormData.type} onValueChange={(v) => onFormDataChange({ ...categoryFormData, type: v as typeof categoryFormData.type })}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="static">Static (Fixed monthly)</SelectItem>
                                <SelectItem value="dynamic">Dynamic (Rolling average)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Default Amount</Label>
                        <Input
                            type="number"
                            value={categoryFormData.default_amount}
                            onChange={(e) => onFormDataChange({ ...categoryFormData, default_amount: e.target.value })}
                            placeholder="0"
                        />
                    </div>

                    {/* Electricity Special Fields */}
                    {editingCategoryId && editingCategory?.category === "electricity" && (
                        <>
                            <div className="space-y-2">
                                <Label>Grid Amount</Label>
                                <Input
                                    type="number"
                                    value={electricityGrid}
                                    onChange={(e) => onElectricityGridChange(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Market Amount</Label>
                                <Input
                                    type="number"
                                    value={electricityMarket}
                                    onChange={(e) => onElectricityMarketChange(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Total: {(parseFloat(electricityGrid || "0") + parseFloat(electricityMarket || "0")).toFixed(0)}
                            </p>
                        </>
                    )}

                    {/* Rent Special Fields */}
                    {editingCategoryId && editingCategory?.category === "rent" && (
                        <>
                            <div className="flex items-center space-x-2">
                                <Switch
                                    checked={waterIncluded}
                                    onCheckedChange={onWaterIncludedChange}
                                />
                                <Label>Water Included</Label>
                            </div>
                            {!waterIncluded && (
                                <div className="space-y-2">
                                    <Label>Water Cost</Label>
                                    <Input
                                        type="number"
                                        value={waterCost}
                                        onChange={(e) => onWaterCostChange(e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
                <DialogFooter className="flex-col gap-2">
                    <Button onClick={onSave} className="w-full">
                        {editingCategoryId ? "Update" : "Add"}
                    </Button>
                    {editingCategoryId && (
                        <div className="flex gap-2 w-full">
                            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    onDelete(editingCategoryId);
                                    onOpenChange(false);
                                }}
                                className="flex-1"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
