import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEncryptedFields, incomeSourceFields } from "@/hooks/useEncryptedFields";

interface SourceFormData {
    category: "salary" | "business_income" | "government_benefits" | "investment_income" | "gift" | "other";
    name: string;
    default_amount: string;
    owner_id: string;
    is_shared: boolean;
    co_parent_id: string;
    share_percentage: string;
}

export const useIncomeSources = (
    householdId: string,
    members: any[],
    onUpdate: () => void
) => {
    const { toast } = useToast();
    const { encryptRecord } = useEncryptedFields(incomeSourceFields);
    const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
    const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
    const [sourceFormData, setSourceFormData] = useState<SourceFormData>({
        category: "salary",
        name: "",
        default_amount: "0",
        owner_id: members[0]?.user_id || "",
        is_shared: false,
        co_parent_id: "",
        share_percentage: "50",
    });

    const resetSourceForm = () => {
        setSourceFormData({
            category: "salary",
            name: "",
            default_amount: "0",
            owner_id: members[0]?.user_id || "",
            is_shared: false,
            co_parent_id: "",
            share_percentage: "50",
        });
        setEditingSourceId(null);
    };

    const handleEditSource = (source: any) => {
        setSourceFormData({
            category: source.category,
            name: source.name,
            default_amount: source.default_amount.toString(),
            owner_id: source.created_by || source.owner_id, // Map created_by to owner_id for form
            is_shared: source.is_shared || false,
            co_parent_id: source.co_parent_id || "",
            share_percentage: source.share_percentage?.toString() || "50",
        });
        setEditingSourceId(source.id);
        setSourceDialogOpen(true);
    };

    const handleSaveSource = async () => {
        const baseData = {
            household_id: householdId,
            category: sourceFormData.category,
            name: sourceFormData.name,
            default_amount: parseFloat(sourceFormData.default_amount),
            created_by: sourceFormData.owner_id, // Map form owner_id to database created_by
            is_shared: sourceFormData.is_shared,
            co_parent_id: sourceFormData.is_shared ? sourceFormData.co_parent_id : null,
            share_percentage: sourceFormData.is_shared ? parseFloat(sourceFormData.share_percentage) : null,
        };

        // Encrypt sensitive fields (name, default_amount)
        const data = await encryptRecord(baseData);

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
            setSourceDialogOpen(false);
            resetSourceForm();
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
