import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SourceFormData {
    category: "salary" | "business_income" | "government_benefits" | "investment_income" | "gift" | "other";
    name: string;
    type: "static" | "variable";
    default_amount: string;
    owner_id: string;
}

export const useIncomeSources = (
    householdId: string,
    members: any[],
    onUpdate: () => void
) => {
    const { toast } = useToast();
    const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
    const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
    const [sourceFormData, setSourceFormData] = useState<SourceFormData>({
        category: "salary",
        name: "",
        type: "static",
        default_amount: "0",
        owner_id: members[0]?.user_id || "",
    });

    const resetSourceForm = () => {
        setSourceFormData({
            category: "salary",
            name: "",
            type: "static",
            default_amount: "0",
            owner_id: members[0]?.user_id || "",
        });
        setEditingSourceId(null);
    };

    const handleEditSource = (source: any) => {
        setSourceFormData({
            category: source.category,
            name: source.name,
            type: source.type,
            default_amount: source.default_amount.toString(),
            owner_id: source.owner_id,
        });
        setEditingSourceId(source.id);
        setSourceDialogOpen(true);
    };

    const handleSaveSource = async () => {
        const data = {
            household_id: householdId,
            category: sourceFormData.category,
            name: sourceFormData.name,
            type: sourceFormData.type,
            default_amount: parseFloat(sourceFormData.default_amount),
            owner_id: sourceFormData.owner_id,
        };

        let error;
        if (editingSourceId) {
            ({ error } = await supabase
                .from("income_sources")
                .update(data)
                .eq("id", editingSourceId));
        } else {
            ({ error } = await supabase
                .from("income_sources")
                .insert(data));
        }

        if (error) {
            toast({
                title: "Error",
                description: "Failed to save income source",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: editingSourceId ? "Income source updated" : "Income source added",
            });
            setSourceDialogOpen(false);
            resetSourceForm();
            onUpdate();
        }
    };

    const handleDeleteSource = async (id: string) => {
        const { error } = await supabase
            .from("income_sources")
            .delete()
            .eq("id", id);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to delete income source",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: "Income source deleted",
            });
            onUpdate();
        }
    };

    return {
        sourceDialogOpen,
        setSourceDialogOpen,
        editingSourceId,
        sourceFormData,
        setSourceFormData,
        handleEditSource,
        handleSaveSource,
        handleDeleteSource,
        resetSourceForm,
    };
};
