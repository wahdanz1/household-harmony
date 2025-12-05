import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CategoryFormData {
    name: string;
    type: "static" | "dynamic";
    default_amount: string;
}

export const useRegularExpenses = (
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

    // Special field states for Electricity
    const [electricityGrid, setElectricityGrid] = useState("");
    const [electricityMarket, setElectricityMarket] = useState("");

    // Special field states for Rent
    const [waterIncluded, setWaterIncluded] = useState(true);
    const [waterCost, setWaterCost] = useState("");

    const resetCategoryForm = () => {
        setCategoryFormData({
            name: "",
            type: "static",
            default_amount: "0",
        });
        setEditingCategoryId(null);
        setElectricityGrid("");
        setElectricityMarket("");
        setWaterIncluded(true);
        setWaterCost("");
    };

    const handleEditCategory = (category: any) => {
        const metadata = category.metadata || {};

        setCategoryFormData({
            name: category.name,
            type: category.type,
            default_amount: category.default_amount.toString(),
        });

        // Load Electricity metadata
        if (category.category === "electricity") {
            setElectricityGrid(metadata.electricity_grid?.toString() || "");
            setElectricityMarket(metadata.electricity_market?.toString() || "");
        }

        // Load Rent metadata
        if (category.category === "rent") {
            setWaterIncluded(metadata.water_included !== false);
            setWaterCost(metadata.water_cost?.toString() || "");
        }

        setEditingCategoryId(category.id);
        setCategoryDialogOpen(true);
    };

    const handleSaveCategory = async (submittedData?: any) => {
        // Use submitted data if provided, otherwise fall back to state
        const dataName = submittedData?.name || categoryFormData.name;
        const dataType = submittedData?.type || categoryFormData.type;
        const dataDefaultAmount = submittedData?.default_amount || categoryFormData.default_amount;
        const dataCategory = submittedData?.category; // New form provides category

        // Find the category being edited to check for special fields (fallback)
        const editingCategory = expenseCategories.find(c => c.id === editingCategoryId);
        const categoryType = dataCategory || editingCategory?.category;

        // Build metadata object for Electricity and Rent
        let metadata = null;
        let calculatedDefaultAmount = parseFloat(dataDefaultAmount);

        if (categoryType === "electricity") {
            const grid = parseFloat(submittedData?.electricityGrid || electricityGrid || "0");
            const market = parseFloat(submittedData?.electricityMarket || electricityMarket || "0");

            metadata = {
                electricity_grid: grid,
                electricity_market: market,
            };

            // For Electricity, default_amount is the SUM of Grid + Market
            calculatedDefaultAmount = grid + market;
        } else if (categoryType === "rent") {
            const isWaterIncluded = submittedData !== undefined ? submittedData.waterIncluded : waterIncluded;
            const cost = parseFloat(submittedData?.waterCost || waterCost || "0");

            metadata = {
                water_included: isWaterIncluded,
                water_cost: isWaterIncluded ? 0 : cost,
            };
        }

        const data: any = {
            household_id: householdId,
            name: dataName,
            type: dataType,
            default_amount: calculatedDefaultAmount,
            sort_order: expenseCategories.length,
        };

        // If we have a category type (from new form or existing), include it
        // This allows changing the category of an existing expense
        if (categoryType) {
            data.category = categoryType;
        }

        // Add metadata if it exists
        if (metadata) {
            data.metadata = metadata;
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

    const handleDeleteCategory = async (id: string) => {
        const { error } = await supabase
            .from("regular_expenses")
            .delete()
            .eq("id", id);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to delete expense category",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: "Category deleted",
            });
            onUpdate();
        }
    };

    const initializeDefaults = async () => {
        const DEFAULT_CATEGORIES = {
            static: [
                "Rent", "Electricity", "Internet", "Phone", "Insurance", "Loan Payments"
            ],
            dynamic: [
                "Groceries", "Fuel", "Dining Out", "Entertainment",
                "Shopping", "Healthcare", "Personal Care"
            ]
        };

        const categories = [
            ...DEFAULT_CATEGORIES.static.map((name, index) => ({
                household_id: householdId,
                name,
                type: "static" as const,
                default_amount: 0,
                sort_order: index,
            })),
            ...DEFAULT_CATEGORIES.dynamic.map((name, index) => ({
                household_id: householdId,
                name,
                type: "dynamic" as const,
                default_amount: 0,
                sort_order: DEFAULT_CATEGORIES.static.length + index,
            })),
        ];

        const { error } = await supabase
            .from("regular_expenses")
            .insert(categories);

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
        electricityGrid,
        setElectricityGrid,
        electricityMarket,
        setElectricityMarket,
        waterIncluded,
        setWaterIncluded,
        waterCost,
        setWaterCost,
        handleEditCategory,
        handleSaveCategory,
        handleDeleteCategory,
        initializeDefaults,
        resetCategoryForm,
    };
};
