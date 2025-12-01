import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExpenseCategoryForm, ExpenseCategoryFormData } from "./forms/ExpenseCategoryForm";

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
    onSave: (data: any) => void;
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
    onSave,
    onDelete,
}: ExpenseCategoryDialogProps) => {
    const editingCategory = expenseCategories.find(c => c.id === editingCategoryId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Expense Category</DialogTitle>
                    <DialogDescription>
                        Update the details for this expense category
                    </DialogDescription>
                </DialogHeader>

                <ExpenseCategoryForm
                    defaultValues={{
                        category: editingCategory?.category,
                        name: categoryFormData.name,
                        type: categoryFormData.type,
                        default_amount: categoryFormData.default_amount,
                        electricityGrid,
                        electricityMarket,
                        waterIncluded,
                        waterCost,
                    }}
                    onSubmit={onSave}
                    onCancel={() => onOpenChange(false)}
                    submitLabel="Update"
                    isEditing={true}
                    onDelete={() => {
                        if (editingCategoryId) {
                            onDelete(editingCategoryId);
                            onOpenChange(false);
                        }
                    }}
                />
            </DialogContent>
        </Dialog>
    );
};
