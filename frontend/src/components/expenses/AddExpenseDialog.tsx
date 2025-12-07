import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Home, CreditCard, Shield, Zap } from "lucide-react";
import { ExpenseForm, ExpenseFormData } from "./forms/ExpenseForm";
import { SubscriptionForm } from "./forms/SubscriptionForm";
import { InsuranceForm } from "./forms/InsuranceForm";
import { TemporaryExpenseForm } from "./forms/TemporaryExpenseForm";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface AddExpenseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    householdId: string;
    hasCoParents: boolean;
    onSuccess: () => void;
}

type ExpenseType = "expense" | "subscription" | "insurance" | "temporary" | null;

const expenseTypes = [
    {
        id: "expense" as const,
        label: "Expense",
        description: "Regular household expenses",
        icon: Home,
        color: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20",
        iconColor: "text-blue-500",
    },
    {
        id: "subscription" as const,
        label: "Subscription",
        description: "Recurring bills & services",
        icon: CreditCard,
        color: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20",
        iconColor: "text-purple-500",
    },
    {
        id: "insurance" as const,
        label: "Insurance",
        description: "Insurance policies",
        icon: Shield,
        color: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20",
        iconColor: "text-amber-500",
    },
    {
        id: "temporary" as const,
        label: "Temporary",
        description: "One-time unexpected costs",
        icon: Zap,
        color: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20",
        iconColor: "text-orange-500",
    },
];

export const AddExpenseDialog = ({ open, onOpenChange, householdId, hasCoParents, onSuccess }: AddExpenseDialogProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [selectedType, setSelectedType] = useState<ExpenseType>(null);
    const [saving, setSaving] = useState(false);

    const handleClose = () => {
        setSelectedType(null);
        onOpenChange(false);
    };

    const handleBack = () => {
        setSelectedType(null);
    };

    const handleSuccess = () => {
        onSuccess();
        handleClose();
    };

    // Handle Fixed/Variable expense submission (INSERT to regular_expenses)
    const handleExpenseSubmit = async (data: ExpenseFormData) => {
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

        const { error } = await supabase.from("regular_expenses").insert({
            household_id: householdId,
            category: data.category,
            name: data.name,
            type: data.type,
            default_amount: parseFloat(data.default_amount),
            created_by: user.id,
            is_active: true,
            sort_order: 999,
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
            handleSuccess();
        }
    };

    const availableTypes = expenseTypes;

    // Get label for dialog title
    const getTypeLabel = () => {
        const type = expenseTypes.find(t => t.id === selectedType);
        return type?.label || selectedType;
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{selectedType ? `Add ${getTypeLabel()}` : "Add Expense"}</DialogTitle>
                    <DialogDescription>
                        {selectedType ? "Fill in the details below" : "Choose the type of expense you want to add"}
                    </DialogDescription>
                </DialogHeader>

                {!selectedType ? (
                    <div className={cn(
                        "grid gap-3",
                        hasCoParents ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
                    )}>
                        {availableTypes.map((type) => {
                            const Icon = type.icon;
                            return (
                                <button
                                    key={type.id}
                                    onClick={() => setSelectedType(type.id)}
                                    className={cn(
                                        "p-4 rounded-lg border-2 transition-all cursor-pointer text-left",
                                        "hover:scale-105 active:scale-95",
                                        type.color
                                    )}
                                >
                                    <div className="flex flex-col items-center text-center gap-2">
                                        <div className={cn("p-2 rounded-full bg-background/50", type.iconColor)}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">{type.label}</h3>
                                            <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt-4">
                        {selectedType === "expense" && (
                            <ExpenseForm
                                defaultValues={{
                                    category: undefined,
                                    name: "",
                                    type: "dynamic",
                                    default_amount: "0",
                                }}
                                onSubmit={handleExpenseSubmit}
                                onCancel={handleBack}
                                submitLabel="Create Expense"
                                isSaving={saving}
                            />
                        )}
                        {selectedType === "subscription" && (
                            <SubscriptionForm
                                householdId={householdId}
                                onSuccess={handleSuccess}
                                onCancel={handleBack}
                            />
                        )}
                        {selectedType === "insurance" && (
                            <InsuranceForm
                                householdId={householdId}
                                onSuccess={handleSuccess}
                                onCancel={handleBack}
                            />
                        )}
                        {selectedType === "temporary" && (
                            <TemporaryExpenseForm
                                householdId={householdId}
                                onSuccess={handleSuccess}
                                onCancel={handleBack}
                            />
                        )}

                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
