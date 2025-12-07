import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExpenseForm } from "./forms/ExpenseForm";

interface EditExpenseDialogProps {
    open: boolean;
    editingCategoryId: string | null;
    categoryFormData: {
        name: string;
        type: "static" | "dynamic";
        default_amount: string;
    };
    expenseCategories: any[];
    onOpenChange: (open: boolean) => void;
    onSave: (data: any) => void;
    onDelete: (id: string) => void;
}

export const EditExpenseDialog = ({
    open,
    editingCategoryId,
    categoryFormData,
    expenseCategories,
    onOpenChange,
    onSave,
    onDelete,
}: EditExpenseDialogProps) => {
    const editingCategory = expenseCategories.find(c => c.id === editingCategoryId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Expense Item</DialogTitle>
                    <DialogDescription>
                        Update the details for this expense
                    </DialogDescription>
                </DialogHeader>

                <ExpenseForm
                    defaultValues={{
                        category: editingCategory?.category,
                        name: categoryFormData.name,
                        type: categoryFormData.type,
                        default_amount: categoryFormData.default_amount,
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
