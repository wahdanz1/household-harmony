import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ExpenseCategoryForm, ExpenseCategoryFormData } from "./ExpenseCategoryForm";

interface RegularExpenseFormProps {
    householdId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export const RegularExpenseForm = ({ householdId, onSuccess, onCancel }: RegularExpenseFormProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (data: ExpenseCategoryFormData) => {
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

        if (data.category === "electricity") {
            metadata.electricity_grid = parseFloat(data.electricityGrid || "0");
            metadata.electricity_market = parseFloat(data.electricityMarket || "0");
        }

        if (data.category === "rent") {
            metadata.water_included = data.waterIncluded;
            if (!data.waterIncluded) {
                metadata.water_cost = parseFloat(data.waterCost || "0");
            }
        }

        const { error } = await supabase.from("expense_categories").insert({
            household_id: householdId,
            category: data.category,
            name: data.name,
            type: data.type,
            default_amount: parseFloat(data.default_amount),
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

    return (
        <ExpenseCategoryForm
            onSubmit={handleSubmit}
            onCancel={onCancel}
            submitLabel="Create Expense"
            isSaving={saving}
        />
    );
};
