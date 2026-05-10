import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InsuranceForm } from "./forms/InsuranceForm";

interface InsuranceFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: "add" | "edit";
    householdId: string;
    initialValues?: {
        id?: string;
        name?: string;
        provider?: string | null;
        category?: string;
        total_amount?: number | string;
        payment_frequency?: string;
        invoice_month?: number | string | null;
        notes?: string | null;
        is_active?: boolean;
        is_shared?: boolean;
        co_parent_id?: string | null;
        share_percentage?: number | string;
    };
    onSuccess?: () => void;
}

export const InsuranceFormDialog = ({
    open, onOpenChange, mode, householdId, initialValues, onSuccess,
}: InsuranceFormDialogProps) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{mode === "edit" ? "Edit insurance" : "Add insurance"}</DialogTitle>
                <DialogDescription>
                    Yearly/semi-annual amounts are auto-spread across the months.
                </DialogDescription>
            </DialogHeader>
            <InsuranceForm
                householdId={householdId}
                editingId={mode === "edit" ? initialValues?.id : undefined}
                initialValues={initialValues}
                onSuccess={() => {
                    onSuccess?.();
                    if (mode === "edit") onOpenChange(false);
                }}
                onCancel={() => onOpenChange(false)}
                onDelete={mode === "edit" ? () => {
                    onSuccess?.();
                    onOpenChange(false);
                } : undefined}
            />
        </DialogContent>
    </Dialog>
);
