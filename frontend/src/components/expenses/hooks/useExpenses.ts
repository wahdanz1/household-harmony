import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEncryptedFields, expenseFields } from "@/hooks/useEncryptedFields";

interface CategoryFormData {
    name: string;
    default_amount: string;
    is_credit?: boolean;
}

export const useExpenses = (
    householdId: string,
    expenseCategories: any[],
    onUpdate: () => void
) => {
    const { toast } = useToast();
    const { encryptRecord } = useEncryptedFields(expenseFields);
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [categoryFormData, setCategoryFormData] = useState<CategoryFormData>({
        name: "",
        default_amount: "0",
        is_credit: false,
    });

    const resetCategoryForm = () => {
        setCategoryFormData({
            name: "",
            default_amount: "0",
            is_credit: false,
        });
        setEditingCategoryId(null);
    };

    const handleEditCategory = (category: any) => {
        setCategoryFormData({
            name: category.name,
            default_amount: category.default_amount.toString(),
            is_credit: category.is_credit ?? false,
        });

        setEditingCategoryId(category.id);
        setCategoryDialogOpen(true);
    };

    const handleSaveCategory = async (submittedData?: any) => {
        // Use submitted data if provided, otherwise fall back to state
        const dataName = submittedData?.name || categoryFormData.name;
        const dataDefaultAmount = submittedData?.default_amount || categoryFormData.default_amount;
        const dataCategory = submittedData?.category;
        const dataIsCredit = submittedData?.is_credit ?? false;

        const baseData: any = {
            household_id: householdId,
            name: dataName,
            default_amount: parseFloat(dataDefaultAmount),
            sort_order: expenseCategories.length,
            is_credit: dataIsCredit,
        };

        // If we have a category type (from new form or existing), include it
        if (dataCategory) {
            baseData.category = dataCategory;
        }

        // Encrypt sensitive fields (name, default_amount)
        const data = await encryptRecord(baseData);

        let error;
        if (editingCategoryId) {
            ({ error } = await supabase
                .from("expenses")
                .update(data)
                .eq("id", editingCategoryId));
        } else {
            ({ error } = await supabase
                .from("expenses")
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
            .from("expenses")
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
        const defaultCategories: { name: string; category: string; default_amount: number; sort_order: number; household_id: string }[] = [
            { name: "Rent", category: "rent", default_amount: 0, sort_order: 0, household_id: householdId },
            { name: "Electricity", category: "electricity", default_amount: 0, sort_order: 1, household_id: householdId },
            { name: "Fuel", category: "fuel", default_amount: 0, sort_order: 2, household_id: householdId },
            { name: "Transport", category: "transport", default_amount: 0, sort_order: 3, household_id: householdId },
            { name: "Groceries", category: "groceries", default_amount: 0, sort_order: 4, household_id: householdId },
        ];

        // Encrypt each default category before inserting
        const encryptedCategories = await Promise.all(
            defaultCategories.map(cat => encryptRecord(cat))
        );

        const { error } = await supabase
            .from("expenses")
            .insert(encryptedCategories);

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
