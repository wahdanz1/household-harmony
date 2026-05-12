import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SubscriptionForm } from "./forms/SubscriptionForm";

interface SubscriptionFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: "add" | "edit";
    householdId: string;
    initialValues?: {
        id?: string;
        name?: string;
        service?: string;
        amount?: number | string;
        billing_cycle?: string;
        category?: string;
        notes?: string;
        is_active?: boolean;
        billing_day?: number;
        billing_month?: number;
        subject_id?: string | null;
    };
    onSuccess?: () => void;
}

export const SubscriptionFormDialog = ({
    open, onOpenChange, mode, householdId, initialValues, onSuccess,
}: SubscriptionFormDialogProps) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{mode === "edit" ? "Edit subscription" : "Add subscription"}</DialogTitle>
                <DialogDescription>Recurring bill or service.</DialogDescription>
            </DialogHeader>
            <SubscriptionForm
                householdId={householdId}
                editingId={mode === "edit" ? initialValues?.id : undefined}
                initialValues={initialValues}
                onSuccess={() => onSuccess?.()}
                onCancel={() => onOpenChange(false)}
                onClose={() => onOpenChange(false)}
                onDelete={mode === "edit" ? () => {
                    onSuccess?.();
                    onOpenChange(false);
                } : undefined}
            />
        </DialogContent>
    </Dialog>
);
