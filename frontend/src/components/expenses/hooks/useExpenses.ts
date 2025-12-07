import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CategoryFormData {
    name: string;
    type: "static" | "dynamic";
    default_amount: string;
}

export const useExpenses = (
    householdId: string,
    expenseCategories: any[],
    onUpdate: () => void
) => {
    const { toast } = useToast();
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [categoryFormData, setCategoryFormData] = useState<CategoryFormData>({
        name: "",
        type: "static",
        default_amount: "0",
    });

    const resetCategoryForm = () => {
        setCategoryFormData({
            name: "",
            type: "static",
            default_amount: "0",
        });
        setEditingCategoryId(null);
    };

    const handleEditCategory = (category: any) => {
        setCategoryFormData({
            name: category.name,
            type: category.type,
            default_amount: category.default_amount.toString(),
        });

        setEditingCategoryId(category.id);
        setCategoryDialogOpen(true);
    };

    const handleSaveCategory = async (submittedData?: any) => {
        // Use submitted data if provided, otherwise fall back to state
        const dataName = submittedData?.name || categoryFormData.name;
        const dataType = submittedData?.type || categoryFormData.type;
        const dataDefaultAmount = submittedData?.default_amount || categoryFormData.default_amount;
        const dataCategory = submittedData?.category;

        const data: any = {
            household_id: householdId,
            name: dataName,
            type: dataType,
            default_amount: parseFloat(dataDefaultAmount),
            sort_order: expenseCategories.length,
        };

        // If we have a category type (from new form or existing), include it
        if (dataCategory) {
            data.category = dataCategory;
        }

        let error;
        if (editingCategoryId) {
            ({ error } = await supabase
                .from("regular_expenses")
                .update(data)
                .eq("id", editingCategoryId));
        } else {
            ({ error } = await supabase
                .from("regular_expenses")
                .insert(data));
        }

        if (error) {
            toast({
                title: "Error",
                description: "Failed to save expense category",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: editingCategoryId ? "Expense updated" : "Expense added",
            });
            setCategoryDialogOpen(false);
            resetCategoryForm();
            onUpdate();
        }
    };

    const handleDeleteCategory = async (categoryId: string) => {
        const { error } = await supabase
            .from("regular_expenses")
            .delete()
            .eq("id", categoryId);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to delete expense category",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: "Expense category deleted",
            });
            setCategoryDialogOpen(false);
            resetCategoryForm();
            onUpdate();
        }
    };

    const initializeDefaults = async () => {
        const defaultCategories: { name: string; category: string; type: "static" | "dynamic"; default_amount: number; sort_order: number; household_id: string }[] = [
            { name: "Rent", category: "rent", type: "static", default_amount: 0, sort_order: 0, household_id: householdId },
            { name: "Electricity", category: "electricity", type: "dynamic", default_amount: 0, sort_order: 1, household_id: householdId },
            { name: "Fuel", category: "fuel", type: "dynamic", default_amount: 0, sort_order: 2, household_id: householdId },
            { name: "Transport", category: "transport", type: "dynamic", default_amount: 0, sort_order: 3, household_id: householdId },
            { name: "Groceries", category: "groceries", type: "dynamic", default_amount: 0, sort_order: 4, household_id: householdId },
        ];

        const { error } = await supabase
            .from("regular_expenses")
            .insert(defaultCategories);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to initialize default categories",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: "Default expense categories added",
            });
            onUpdate();
        }
    };

    return {
        categoryDialogOpen,
        setCategoryDialogOpen,
        editingCategoryId,
        categoryFormData,
        setCategoryFormData,
        handleEditCategory,
        handleSaveCategory,
        handleDeleteCategory,
        initializeDefaults,
        resetCategoryForm,
    };
};
