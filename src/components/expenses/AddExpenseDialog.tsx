import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, CreditCard, Shield, Users, Zap } from "lucide-react";
import { AddRegularExpenseForm } from "./forms/AddRegularExpenseForm";
import { SubscriptionForm } from "./forms/SubscriptionForm";
import { InsuranceForm } from "./forms/InsuranceForm";
import { SharedExpenseForm } from "./forms/SharedExpenseForm";
import { TemporaryExpenseForm } from "./forms/TemporaryExpenseForm";
import { cn } from "@/lib/utils";

interface AddExpenseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    householdId: string;
    hasCoParents: boolean;
    onSuccess: () => void;
}

type ExpenseType = "regular" | "subscription" | "insurance" | "temporary" | "shared" | null;

const expenseTypes = [
    {
        id: "regular" as const,
        label: "Regular",
        description: "Monthly expense categories",
        icon: CalendarDays,
        color: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20",
        iconColor: "text-blue-500",
    },
    {
        id: "subscription" as const,
        label: "Subscription",
        description: "Recurring bills",
        icon: CreditCard,
        color: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20",
        iconColor: "text-purple-500",
    },
    {
        id: "insurance" as const,
        label: "Insurance",
        description: "Insurance policies",
        icon: Shield,
        color: "bg-green-500/10 hover:bg-green-500/20 border-green-500/20",
        iconColor: "text-green-500",
    },
    {
        id: "temporary" as const,
        label: "Temporary",
        description: "One-time expenses",
        icon: Zap,
        color: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20",
        iconColor: "text-amber-500",
    },
    {
        id: "shared" as const,
        label: "Shared",
        description: "Co-parent expenses",
        icon: Users,
        color: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20",
        iconColor: "text-orange-500",
    },
];

export const AddExpenseDialog = ({ open, onOpenChange, householdId, hasCoParents, onSuccess }: AddExpenseDialogProps) => {
    const [selectedType, setSelectedType] = useState<ExpenseType>(null);

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

    const availableTypes = hasCoParents ? expenseTypes : expenseTypes.filter(t => t.id !== "shared");

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{selectedType ? `Add ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Expense` : "Add Expense"}</DialogTitle>
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
                        {selectedType === "regular" && (
                            <AddRegularExpenseForm
                                householdId={householdId}
                                onSuccess={handleSuccess}
                                onCancel={handleBack}
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
                        {selectedType === "shared" && (
                            <SharedExpenseForm
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
