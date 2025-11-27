import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarDays, CreditCard, Shield, Users } from "lucide-react";
import { RegularExpenseForm } from "./forms/RegularExpenseForm";
import { cn } from "@/lib/utils";

interface AddExpenseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    householdId: string;
    hasCoParents: boolean;
    onSuccess: () => void;
}

type ExpenseType = "regular" | "subscription" | "insurance" | "shared" | null;

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
                        "grid gap-4",
                        hasCoParents ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3"
                    )}>
                        {availableTypes.map((type) => {
                            const Icon = type.icon;
                            return (
                                <button
                                    key={type.id}
                                    onClick={() => setSelectedType(type.id)}
                                    className={cn(
                                        "p-6 rounded-lg border-2 transition-all cursor-pointer text-left",
                                        "hover:scale-105 active:scale-95",
                                        type.color
                                    )}
                                >
                                    <div className="flex flex-col items-center text-center gap-3">
                                        <div className={cn("p-3 rounded-full bg-background/50", type.iconColor)}>
                                            <Icon className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-lg">{type.label}</h3>
                                            <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt-4">
                        {selectedType === "regular" && (
                            <RegularExpenseForm
                                householdId={householdId}
                                onSuccess={handleSuccess}
                                onCancel={handleClose}
                            />
                        )}
                        {selectedType === "subscription" && (
                            <div className="text-center py-8 space-y-4">
                                <p className="text-muted-foreground">
                                    Subscription forms are available in the <strong>Subscriptions tab</strong>.
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    For now, please use the Subscriptions tab to add recurring subscription services.
                                </p>
                                <Button onClick={handleClose} variant="outline">
                                    Close
                                </Button>
                            </div>
                        )}
                        {selectedType === "insurance" && (
                            <div className="text-center py-8 space-y-4">
                                <p className="text-muted-foreground">
                                    Insurance forms are available in the <strong>Insurance tab</strong>.
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    For now, please use the Insurance tab to add insurance policies.
                                </p>
                                <Button onClick={handleClose} variant="outline">
                                    Close
                                </Button>
                            </div>
                        )}
                        {selectedType === "shared" && (
                            <div className="text-center py-8 space-y-4">
                                <p className="text-muted-foreground">
                                    Shared expense forms are available in the <strong>Shared tab</strong>.
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    For now, please use the Shared tab to add co-parent shared expenses.
                                </p>
                                <Button onClick={handleClose} variant="outline">
                                    Close
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
