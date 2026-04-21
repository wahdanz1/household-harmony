import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExpenseForm } from "./forms/ExpenseForm";

interface EditExpenseDialogProps {
    open: boolean;
    editingCategoryId: string | null;
    categoryFormData: {
        name: string;
        default_amount: string;
        is_credit?: boolean;
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
                        default_amount: categoryFormData.default_amount,
                        is_credit: editingCategory?.is_credit ?? categoryFormData.is_credit ?? false,
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
