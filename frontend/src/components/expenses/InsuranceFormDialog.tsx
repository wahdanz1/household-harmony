import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InsuranceForm } from "./forms/InsuranceForm";
import type { AttributionValue } from "@/components/shared/AttributionPicker";

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
        budget?: number | string;
        billing_cycle?: string;
        billing_month?: number | string | null;
        billing_day?: number | string | null;
        notes?: string | null;
        is_active?: boolean;
        is_shared?: boolean;
        co_parent_id?: string | null;
        share_percentage?: number | string;
        attribution?: AttributionValue;
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
